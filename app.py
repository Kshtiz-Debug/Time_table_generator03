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
from typing import Dict, List, Any, Optional, Tuple

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
    def __init__(self, data: Dict[str, Any]):
        self.departments: List[Dict[str, Any]] = data.get('departments', [])
        self.num_days: int = int(data.get('numDays', 5))
        self.num_slots: int = int(data.get('numSlots', 6))
        self.has_clusters: bool = bool(data.get('hasClusters', False))
        self.num_clusters: int = int(data.get('numClusters', 2))
        self.section_cluster_map: Dict[str, int] = {}
        self.subjects: List[Dict[str, Any]] = data.get('subjects', [])
        self.teachers: List[Dict[str, Any]] = data.get('teachers', [])
        self.rooms: List[Dict[str, Any]] = data.get('rooms', [])
        self.constraints: Dict[str, Any] = data.get('constraints', {})
        self.lunch_slot: Optional[int] = int(self.num_slots // 2) if self.constraints.get('fixedLunch', False) else None

        # Build helper maps
        self.subject_map: Dict[str, Dict[str, Any]] = {str(s.get('name', '')): s for s in self.subjects}
        self.teacher_subject_map: Dict[str, List[Dict[str, Any]]] = {}
        for t in self.teachers:
            t_name = str(t.get('name', '')).strip()
            t_id = str(t.get('id', '')).strip()
            if not t_id:
                t_id = f"T-{random.randint(1000, 9999)}"
            t_uid = f"{t_name} ({t_id})" if t_name else t_id
            t_cluster = int(t.get('cluster', 1))
            
            for subj in t.get('subjects', []):
                subj_str = str(subj)
                if subj_str not in self.teacher_subject_map:
                    self.teacher_subject_map[subj_str] = []
                self.teacher_subject_map[subj_str].append({
                    'uid': t_uid,
                    'cluster': t_cluster
                })

        self.classrooms = [r for r in self.rooms if r.get('type', 'Classroom') == 'Classroom']
        self.labs = [r for r in self.rooms if r.get('type', 'Classroom') == 'Lab']

    def generate(self) -> Dict[str, Any]:
        """Generate timetables for all sections."""
        results: Dict[str, Any] = {}
        teacher_schedule: Dict[str, Dict[Tuple[int, int], str]] = {}  # {teacher_name: {(day, slot): section}}
        room_schedule: Dict[str, Dict[Tuple[int, int], str]] = {}     # {room_name: {(day, slot): section}}

        sections: List[str] = []
        self.section_cluster_map.clear()
        for dept in self.departments:
            dept_name = dept['name']
            num_sections = int(dept.get('sections', 1))
            
            if self.has_clusters and self.num_clusters > 0:
                cluster_size = max(1, (num_sections + self.num_clusters - 1) // self.num_clusters)
            else:
                cluster_size = num_sections

            for sec_idx in range(num_sections):
                sec_label = chr(65 + sec_idx)  # A, B, C, ...
                section_id = f"{dept_name} - Section {sec_label}"
                sections.append(section_id)
                
                if self.has_clusters:
                    cluster_id = (sec_idx // cluster_size) + 1
                    cluster_id = min(cluster_id, self.num_clusters)
                else:
                    cluster_id = 1
                self.section_cluster_map[section_id] = cluster_id

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

    def _generate_section_timetable(self, section_id: str, teacher_schedule: Dict[str, Dict[Tuple[int, int], str]], room_schedule: Dict[str, Dict[Tuple[int, int], str]]) -> List[List[Dict[str, Any]]]:
        """Generate timetable for a single section using greedy + backtracking."""
        grid: List[List[Optional[Dict[str, Any]]]] = [[None for _ in range(self.num_slots)] for _ in range(self.num_days)]

        # Build list of (subject, hours_needed) assignments
        assignments: List[Dict[str, Any]] = []
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
        formatted: List[List[Dict[str, Any]]] = []
        for day_idx in range(self.num_days):
            day_data: List[Dict[str, Any]] = []
            for slot_idx in range(self.num_slots):
                cell = grid[day_idx][slot_idx]  # type: ignore
                if cell is None:
                    if self.lunch_slot is not None and slot_idx == self.lunch_slot:
                        day_data.append({'subject': 'LUNCH BREAK', 'teacher': '', 'room': '', 'isLunch': True})
                    else:
                        day_data.append({'subject': 'Free', 'teacher': '', 'room': '', 'isFree': True})
                else:
                    day_data.append(cell)
            formatted.append(day_data)

        return formatted

    def _backtrack_fill(self, grid: List[List[Optional[Dict[str, Any]]]], assignments: List[Dict[str, Any]], idx: int, section_id: str, teacher_schedule: Dict[str, Dict[Tuple[int, int], str]], room_schedule: Dict[str, Dict[Tuple[int, int], str]], max_attempts: int = 500) -> bool:
        """Backtracking assignment of subjects to slots."""
        if idx >= len(assignments):
            return True

        assignment = assignments[idx]
        subject_name = assignment['subject']
        is_lab = assignment['is_lab']

        # Create randomized order of (day, slot) positions
        positions: List[Tuple[int, int]] = []
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
            sec_cluster = self.section_cluster_map.get(section_id, 1)
            all_teachers_for_subj = self.teacher_subject_map.get(subject_name, [])
            
            if self.has_clusters:
                available_teachers = [t['uid'] for t in all_teachers_for_subj if t['cluster'] == sec_cluster]
            else:
                available_teachers = [t['uid'] for t in all_teachers_for_subj]

            if not available_teachers:
                available_teachers = ['TBD']

            random.shuffle(available_teachers)
            teacher_found = None
            for t_name in available_teachers:
                if self.constraints.get('avoidTeacherClash', True):
                    if t_name in teacher_schedule and (d, s) in teacher_schedule[t_name]:  # type: ignore
                        continue
                    if is_lab and self.constraints.get('labConsecutive', False):
                        if t_name in teacher_schedule and (d, s + 1) in teacher_schedule[t_name]:  # type: ignore
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
                    if r_name in room_schedule and (d, s) in room_schedule[r_name]:  # type: ignore
                        continue
                    if is_lab and self.constraints.get('labConsecutive', False):
                        if r_name in room_schedule and (d, s + 1) in room_schedule[r_name]:  # type: ignore
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
            grid[d][s] = cell  # type: ignore
            if teacher_found not in teacher_schedule:
                teacher_schedule[teacher_found] = {}  # type: ignore
            teacher_schedule[teacher_found][(d, s)] = section_id  # type: ignore
            
            if room_found not in room_schedule:
                room_schedule[room_found] = {}  # type: ignore
            room_schedule[room_found][(d, s)] = section_id  # type: ignore

            if is_lab and self.constraints.get('labConsecutive', False):
                grid[d][s + 1] = cell  # type: ignore
                teacher_schedule[teacher_found][(d, s + 1)] = section_id  # type: ignore
                room_schedule[room_found][(d, s + 1)] = section_id  # type: ignore

            if self._backtrack_fill(grid, assignments, idx + 1, section_id, teacher_schedule, room_schedule, max_attempts):
                return True

            # Undo
            grid[d][s] = None  # type: ignore
            del teacher_schedule[teacher_found][(d, s)]  # type: ignore
            del room_schedule[room_found][(d, s)]  # type: ignore
            if is_lab and self.constraints.get('labConsecutive', False):
                grid[d][s + 1] = None  # type: ignore
                del teacher_schedule[teacher_found][(d, s + 1)]  # type: ignore
                del room_schedule[room_found][(d, s + 1)]  # type: ignore

        return False

    def _greedy_fill(self, grid: List[List[Optional[Dict[str, Any]]]], assignments: List[Dict[str, Any]], section_id: str, teacher_schedule: Dict[str, Dict[Tuple[int, int], str]], room_schedule: Dict[str, Dict[Tuple[int, int], str]]):
        """Greedy fallback when backtracking fails."""
        for assignment in assignments:
            subject_name = assignment['subject']
            is_lab = assignment['is_lab']
            placed = False

            for d in range(self.num_days):
                if placed:
                    break
                for s in range(self.num_slots):
                    if grid[d][s] is not None:  # type: ignore
                        continue
                    if self.lunch_slot is not None and s == self.lunch_slot:
                        continue

                    sec_cluster = self.section_cluster_map.get(section_id, 1)
                    all_teachers_for_subj = self.teacher_subject_map.get(subject_name, [])
                    if self.has_clusters:
                        available_teachers = [t['uid'] for t in all_teachers_for_subj if t['cluster'] == sec_cluster]
                    else:
                        available_teachers = [t['uid'] for t in all_teachers_for_subj]

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
                    grid[d][s] = cell  # type: ignore
                    if teacher_found not in teacher_schedule:
                        teacher_schedule[teacher_found] = {}  # type: ignore
                    teacher_schedule[teacher_found][(d, s)] = section_id  # type: ignore
                    
                    if room_found not in room_schedule:
                        room_schedule[room_found] = {}  # type: ignore
                    room_schedule[room_found][(d, s)] = section_id  # type: ignore
                    placed = True
                    break

    def _build_teacher_timetables(self, section_timetables: Dict[str, List[List[Dict[str, Any]]]]) -> Dict[str, List[List[Dict[str, Any]]]]:
        """Build a timetable view per teacher."""
        teacher_tt: Dict[str, List[List[Optional[Dict[str, Any]]]]] = {}
        for section_id, t_grid in section_timetables.items():
            for day_idx, day_data in enumerate(t_grid):
                for slot_idx, cell in enumerate(day_data):
                    if cell and cell.get('teacher'):
                        t_name = str(cell['teacher'])
                        if t_name not in teacher_tt:
                            empty_t_grid: List[List[Optional[Dict[str, Any]]]] = [[None for _ in range(self.num_slots)] for _ in range(self.num_days)]
                            teacher_tt[t_name] = empty_t_grid
                        if teacher_tt[t_name][day_idx][slot_idx] is None:  # type: ignore
                            teacher_tt[t_name][day_idx][slot_idx] = {  # type: ignore
                                'subject': cell['subject'],
                                'section': section_id,
                                'room': cell.get('room', ''),
                            }

        # Format
        formatted: Dict[str, List[List[Dict[str, Any]]]] = {}
        for t_name, fmt_grid_in in teacher_tt.items():
            fmt_grid: List[List[Dict[str, Any]]] = []
            for day_idx in range(self.num_days):
                day_data_fmt: List[Dict[str, Any]] = []
                for slot_idx in range(self.num_slots):
                    cell = fmt_grid_in[day_idx][slot_idx]  # type: ignore
                    if cell is None:
                        day_data_fmt.append({'subject': 'Free', 'section': '', 'room': '', 'isFree': True})
                    else:
                        day_data_fmt.append(cell)
                fmt_grid.append(day_data_fmt)
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
