"""
Interactive College Timetable Generator - Backend
Flask server with scheduling logic using Greedy + Backtracking approach.
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import random
import copy
import os

app = Flask(__name__, static_folder='static')
CORS(app)

# ─────────────────────────────────────────────────────────
# Serve Frontend
# ─────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

# ─────────────────────────────────────────────────────────
# Scheduling Engine
# ─────────────────────────────────────────────────────────

class TimetableGenerator:
    def __init__(self, data):
        self.departments = data.get('departments', [])
        self.num_days = data.get('numDays', 5)
        self.num_slots = data.get('numSlots', 6)
        self.subjects = data.get('subjects', [])
        self.teachers = data.get('teachers', [])
        self.rooms = data.get('rooms', [])
        self.constraints = data.get('constraints', {})
        self.lunch_slot = self.num_slots // 2 if self.constraints.get('fixedLunch', False) else None

        # Build helper maps
        self.subject_map = {s['name']: s for s in self.subjects}
        self.teacher_subject_map = {}
        for t in self.teachers:
            for subj in t.get('subjects', []):
                if subj not in self.teacher_subject_map:
                    self.teacher_subject_map[subj] = []
                self.teacher_subject_map[subj].append(t['name'])

        self.classrooms = [r for r in self.rooms if r.get('type', 'Classroom') == 'Classroom']
        self.labs = [r for r in self.rooms if r.get('type', 'Classroom') == 'Lab']

    def generate(self):
        """Generate timetables for all sections."""
        results = {}
        teacher_schedule = {}  # {teacher_name: {(day, slot): section}}
        room_schedule = {}     # {room_name: {(day, slot): section}}

        sections = []
        for dept in self.departments:
            dept_name = dept['name']
            num_sections = dept.get('sections', 1)
            for sec_idx in range(num_sections):
                sec_label = chr(65 + sec_idx)  # A, B, C, ...
                section_id = f"{dept_name} - Section {sec_label}"
                sections.append(section_id)

        for section_id in sections:
            timetable = self._generate_section_timetable(
                section_id, teacher_schedule, room_schedule
            )
            results[section_id] = timetable

        # Generate teacher-wise timetables
        teacher_timetables = self._build_teacher_timetables(results)

        return {
            'sectionTimetables': results,
            'teacherTimetables': teacher_timetables
        }

    def _generate_section_timetable(self, section_id, teacher_schedule, room_schedule):
        """Generate timetable for a single section using greedy + backtracking."""
        grid = [[None for _ in range(self.num_slots)] for _ in range(self.num_days)]

        # Build list of (subject, hours_needed) assignments
        assignments = []
        for subj in self.subjects:
            hours = subj.get('hours', 1)
            is_lab = subj.get('name', '').lower().find('lab') != -1
            for _ in range(hours):
                assignments.append({
                    'subject': subj['name'],
                    'is_lab': is_lab,
                })

        random.shuffle(assignments)

        # Try to place each assignment
        success = self._backtrack_fill(
            grid, assignments, 0, section_id, teacher_schedule, room_schedule
        )

        if not success:
            # Fallback: greedy fill without strict constraints
            grid = [[None for _ in range(self.num_slots)] for _ in range(self.num_days)]
            self._greedy_fill(grid, assignments, section_id, teacher_schedule, room_schedule)

        # Format grid
        formatted = []
        for day_idx in range(self.num_days):
            day_data = []
            for slot_idx in range(self.num_slots):
                cell = grid[day_idx][slot_idx]
                if cell is None:
                    if self.lunch_slot is not None and slot_idx == self.lunch_slot:
                        day_data.append({'subject': 'LUNCH BREAK', 'teacher': '', 'room': '', 'isLunch': True})
                    else:
                        day_data.append({'subject': 'Free', 'teacher': '', 'room': '', 'isFree': True})
                else:
                    day_data.append(cell)
            formatted.append(day_data)

        return formatted

    def _backtrack_fill(self, grid, assignments, idx, section_id, teacher_schedule, room_schedule, max_attempts=500):
        """Backtracking assignment of subjects to slots."""
        if idx >= len(assignments):
            return True

        assignment = assignments[idx]
        subject_name = assignment['subject']
        is_lab = assignment['is_lab']

        # Create randomized order of (day, slot) positions
        positions = []
        for d in range(self.num_days):
            for s in range(self.num_slots):
                positions.append((d, s))
        random.shuffle(positions)

        for (d, s) in positions:
            if grid[d][s] is not None:
                continue
            if self.lunch_slot is not None and s == self.lunch_slot:
                continue

            # Lab requires consecutive slots
            if is_lab and self.constraints.get('labConsecutive', False):
                if s + 1 >= self.num_slots or grid[d][s + 1] is not None:
                    continue
                if self.lunch_slot is not None and s + 1 == self.lunch_slot:
                    continue

            # Find a teacher
            available_teachers = self.teacher_subject_map.get(subject_name, [])
            if not available_teachers:
                available_teachers = [self.teachers[0]['name']] if self.teachers else ['TBD']

            random.shuffle(available_teachers)
            teacher_found = None
            for t_name in available_teachers:
                if self.constraints.get('avoidTeacherClash', True):
                    if t_name in teacher_schedule and (d, s) in teacher_schedule[t_name]:
                        continue
                    if is_lab and self.constraints.get('labConsecutive', False):
                        if t_name in teacher_schedule and (d, s + 1) in teacher_schedule[t_name]:
                            continue
                teacher_found = t_name
                break

            if teacher_found is None:
                continue

            # Find a room
            room_pool = self.labs if is_lab else self.classrooms
            if not room_pool:
                room_pool = self.rooms if self.rooms else [{'name': 'Room 1'}]
            random.shuffle(room_pool)
            room_found = None
            for room in room_pool:
                r_name = room['name']
                if self.constraints.get('avoidRoomClash', True):
                    if r_name in room_schedule and (d, s) in room_schedule[r_name]:
                        continue
                    if is_lab and self.constraints.get('labConsecutive', False):
                        if r_name in room_schedule and (d, s + 1) in room_schedule[r_name]:
                            continue
                room_found = r_name
                break

            if room_found is None:
                continue

            # Place
            cell = {
                'subject': subject_name,
                'teacher': teacher_found,
                'room': room_found,
                'isLab': is_lab
            }
            grid[d][s] = cell
            teacher_schedule.setdefault(teacher_found, {})[(d, s)] = section_id
            room_schedule.setdefault(room_found, {})[(d, s)] = section_id

            if is_lab and self.constraints.get('labConsecutive', False):
                grid[d][s + 1] = cell
                teacher_schedule[teacher_found][(d, s + 1)] = section_id
                room_schedule[room_found][(d, s + 1)] = section_id

            if self._backtrack_fill(grid, assignments, idx + 1, section_id, teacher_schedule, room_schedule, max_attempts):
                return True

            # Undo
            grid[d][s] = None
            del teacher_schedule[teacher_found][(d, s)]
            del room_schedule[room_found][(d, s)]
            if is_lab and self.constraints.get('labConsecutive', False):
                grid[d][s + 1] = None
                del teacher_schedule[teacher_found][(d, s + 1)]
                del room_schedule[room_found][(d, s + 1)]

        return False

    def _greedy_fill(self, grid, assignments, section_id, teacher_schedule, room_schedule):
        """Greedy fallback when backtracking fails."""
        for assignment in assignments:
            subject_name = assignment['subject']
            is_lab = assignment['is_lab']
            placed = False

            for d in range(self.num_days):
                if placed:
                    break
                for s in range(self.num_slots):
                    if grid[d][s] is not None:
                        continue
                    if self.lunch_slot is not None and s == self.lunch_slot:
                        continue

                    available_teachers = self.teacher_subject_map.get(subject_name, [])
                    teacher_found = available_teachers[0] if available_teachers else 'TBD'

                    room_pool = self.labs if is_lab else self.classrooms
                    if not room_pool:
                        room_pool = self.rooms if self.rooms else [{'name': 'Room 1'}]
                    room_found = room_pool[0]['name']

                    cell = {
                        'subject': subject_name,
                        'teacher': teacher_found,
                        'room': room_found,
                        'isLab': is_lab
                    }
                    grid[d][s] = cell
                    teacher_schedule.setdefault(teacher_found, {})[(d, s)] = section_id
                    room_schedule.setdefault(room_found, {})[(d, s)] = section_id
                    placed = True
                    break

    def _build_teacher_timetables(self, section_timetables):
        """Build a timetable view per teacher."""
        teacher_tt = {}
        for section_id, grid in section_timetables.items():
            for day_idx, day_data in enumerate(grid):
                for slot_idx, cell in enumerate(day_data):
                    if cell and cell.get('teacher'):
                        t_name = cell['teacher']
                        if t_name not in teacher_tt:
                            teacher_tt[t_name] = [[None for _ in range(self.num_slots)] for _ in range(self.num_days)]
                        if teacher_tt[t_name][day_idx][slot_idx] is None:
                            teacher_tt[t_name][day_idx][slot_idx] = {
                                'subject': cell['subject'],
                                'section': section_id,
                                'room': cell.get('room', ''),
                            }

        # Format
        formatted = {}
        for t_name, grid in teacher_tt.items():
            fmt_grid = []
            for day_idx in range(self.num_days):
                day_data = []
                for slot_idx in range(self.num_slots):
                    cell = grid[day_idx][slot_idx]
                    if cell is None:
                        day_data.append({'subject': 'Free', 'section': '', 'room': '', 'isFree': True})
                    else:
                        day_data.append(cell)
                fmt_grid.append(day_data)
            formatted[t_name] = fmt_grid

        return formatted


# ─────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────

@app.route('/api/generate', methods=['POST'])
def generate_timetable():
    """Generate timetable from provided configuration."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        generator = TimetableGenerator(data)
        result = generator.generate()

        return jsonify({
            'success': True,
            'data': result,
            'config': {
                'numDays': data.get('numDays', 5),
                'numSlots': data.get('numSlots', 6),
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/save-config', methods=['POST'])
def save_config():
    """Save configuration for future use."""
    try:
        data = request.get_json()
        config_dir = os.path.join(os.path.dirname(__file__), 'configs')
        os.makedirs(config_dir, exist_ok=True)
        filename = data.get('name', 'default') + '.json'
        filepath = os.path.join(config_dir, filename)
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
        return jsonify({'success': True, 'message': f'Configuration saved as {filename}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/load-configs', methods=['GET'])
def load_configs():
    """List saved configurations."""
    try:
        config_dir = os.path.join(os.path.dirname(__file__), 'configs')
        if not os.path.exists(config_dir):
            return jsonify({'configs': []})
        configs = []
        for f in os.listdir(config_dir):
            if f.endswith('.json'):
                filepath = os.path.join(config_dir, f)
                with open(filepath, 'r') as fh:
                    config_data = json.load(fh)
                configs.append({
                    'name': f.replace('.json', ''),
                    'data': config_data
                })
        return jsonify({'configs': configs})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/load-config/<name>', methods=['GET'])
def load_config(name):
    """Load a specific saved configuration."""
    try:
        config_dir = os.path.join(os.path.dirname(__file__), 'configs')
        filepath = os.path.join(config_dir, name + '.json')
        if not os.path.exists(filepath):
            return jsonify({'error': 'Configuration not found'}), 404
        with open(filepath, 'r') as f:
            config_data = json.load(f)
        return jsonify({'success': True, 'data': config_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    os.makedirs('static', exist_ok=True)
    app.run(debug=True, port=5000)
