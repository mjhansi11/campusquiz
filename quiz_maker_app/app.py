import os
import json
from datetime import datetime
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db, init_db

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Ensure database exists
init_db()

def dict_from_row(row):
    return dict(row) if row else None

# ==========================================
# AUTHENTICATION APIs
# Strictly login_id and password based
# ==========================================

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    login_id = (data.get('login_id') or '').strip()
    password = (data.get('password') or '').strip()
    role = data.get('role', 'student')
    display_name = (data.get('display_name') or login_id).strip()

    if not login_id:
        return jsonify({'error': 'Login ID is required'}), 400
    if not password:
        return jsonify({'error': 'Password is required'}), 400
    if role not in ('faculty', 'student'):
        return jsonify({'error': 'Role must be faculty or student'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT id FROM users WHERE login_id = ?', (login_id,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': f"Login ID '{login_id}' is already registered. Please choose another or log in."}), 409

    pwd_hash = generate_password_hash(password)
    cursor.execute(
        'INSERT INTO users (login_id, password_hash, role, display_name) VALUES (?, ?, ?, ?)',
        (login_id, pwd_hash, role, display_name)
    )
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    # Automatically set session
    session['user_id'] = user_id
    session['login_id'] = login_id
    session['role'] = role
    session['display_name'] = display_name

    return jsonify({
        'message': 'Account created successfully',
        'user': {
            'id': user_id,
            'login_id': login_id,
            'role': role,
            'display_name': display_name
        }
    }), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    login_id = (data.get('login_id') or '').strip()
    password = (data.get('password') or '').strip()
    role = data.get('role')

    if not login_id or not password:
        return jsonify({'error': 'Please provide both Login ID and Password'}), 400

    conn = get_db()
    cursor = conn.cursor()

    if role:
        cursor.execute('SELECT * FROM users WHERE login_id = ? AND role = ?', (login_id, role))
    else:
        cursor.execute('SELECT * FROM users WHERE login_id = ?', (login_id,))

    user = cursor.fetchone()
    conn.close()

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Invalid Login ID or Password'}), 401

    session['user_id'] = user['id']
    session['login_id'] = user['login_id']
    session['role'] = user['role']
    session['display_name'] = user['display_name']

    return jsonify({
        'message': 'Logged in successfully',
        'user': {
            'id': user['id'],
            'login_id': user['login_id'],
            'role': user['role'],
            'display_name': user['display_name']
        }
    })

@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    if 'user_id' not in session:
        return jsonify({'logged_in': False}), 200

    return jsonify({
        'logged_in': True,
        'user': {
            'id': session['user_id'],
            'login_id': session['login_id'],
            'role': session['role'],
            'display_name': session.get('display_name', session['login_id'])
        }
    })

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'})

# ==========================================
# FACULTY ENDPOINTS
# Quiz Management & Results Dashboard
# ==========================================

@app.route('/api/faculty/quizzes', methods=['GET'])
def faculty_get_quizzes():
    if session.get('role') != 'faculty':
        return jsonify({'error': 'Faculty access required'}), 403

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT q.*, 
               (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
               (SELECT COUNT(*) FROM submissions WHERE quiz_id = q.id) as submission_count,
               (SELECT AVG(percentage) FROM submissions WHERE quiz_id = q.id) as avg_score
        FROM quizzes q
        ORDER BY q.created_at DESC
    ''')
    rows = cursor.fetchall()
    quizzes = [dict_from_row(r) for r in rows]
    conn.close()
    return jsonify({'quizzes': quizzes})

@app.route('/api/faculty/quizzes', methods=['POST'])
def faculty_create_quiz():
    if session.get('role') != 'faculty':
        return jsonify({'error': 'Faculty access required'}), 403

    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    time_limit = int(data.get('time_limit_minutes', 10))
    passing_pct = int(data.get('passing_percentage', 60))

    if not title:
        return jsonify({'error': 'Quiz title is required'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO quizzes (title, description, faculty_id, faculty_name, time_limit_minutes, passing_percentage, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
    ''', (
        title,
        description,
        session['user_id'],
        session.get('display_name', session['login_id']),
        time_limit,
        passing_pct
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'message': 'Quiz created successfully', 'quiz_id': new_id}), 201

@app.route('/api/faculty/quizzes/<int:quiz_id>', methods=['PUT'])
def faculty_update_quiz(quiz_id):
    if session.get('role') != 'faculty':
        return jsonify({'error': 'Faculty access required'}), 403

    data = request.get_json() or {}
    conn = get_db()
    cursor = conn.cursor()

    if 'is_active' in data:
        cursor.execute('UPDATE quizzes SET is_active = ? WHERE id = ?', (int(bool(data['is_active'])), quiz_id))
    if 'title' in data and data['title'].strip():
        cursor.execute('UPDATE quizzes SET title = ? WHERE id = ?', (data['title'].strip(), quiz_id))
    if 'description' in data:
        cursor.execute('UPDATE quizzes SET description = ? WHERE id = ?', (data['description'].strip(), quiz_id))
    if 'time_limit_minutes' in data:
        cursor.execute('UPDATE quizzes SET time_limit_minutes = ? WHERE id = ?', (int(data['time_limit_minutes']), quiz_id))
    if 'passing_percentage' in data:
        cursor.execute('UPDATE quizzes SET passing_percentage = ? WHERE id = ?', (int(data['passing_percentage']), quiz_id))

    conn.commit()
    conn.close()
    return jsonify({'message': 'Quiz updated successfully'})

@app.route('/api/faculty/quizzes/<int:quiz_id>', methods=['DELETE'])
def faculty_delete_quiz(quiz_id):
    if session.get('role') != 'faculty':
        return jsonify({'error': 'Faculty access required'}), 403

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM questions WHERE quiz_id = ?', (quiz_id,))
    cursor.execute('DELETE FROM submissions WHERE quiz_id = ?', (quiz_id,))
    cursor.execute('DELETE FROM quizzes WHERE id = ?', (quiz_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Quiz and all associated questions & results deleted'})

@app.route('/api/faculty/quizzes/<int:quiz_id>/questions', methods=['GET'])
def faculty_get_questions(quiz_id):
    if session.get('role') != 'faculty':
        return jsonify({'error': 'Faculty access required'}), 403

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM questions WHERE quiz_id = ? ORDER BY id ASC', (quiz_id,))
    questions = [dict_from_row(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'questions': questions})

@app.route('/api/faculty/quizzes/<int:quiz_id>/questions', methods=['POST'])
def faculty_add_question(quiz_id):
    if session.get('role') != 'faculty':
        return jsonify({'error': 'Faculty access required'}), 403

    data = request.get_json() or {}
    q_text = (data.get('question_text') or '').strip()
    opt_a = (data.get('option_a') or '').strip()
    opt_b = (data.get('option_b') or '').strip()
    opt_c = (data.get('option_c') or '').strip()
    opt_d = (data.get('option_d') or '').strip()
    correct = (data.get('correct_option') or 'A').upper().strip()
    points = int(data.get('points', 1))
    explanation = (data.get('explanation') or '').strip()

    if not q_text or not opt_a or not opt_b:
        return jsonify({'error': 'Question text and at least options A and B are required'}), 400

    if correct not in ('A', 'B', 'C', 'D'):
        return jsonify({'error': 'Correct option must be A, B, C, or D'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, points, explanation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (quiz_id, q_text, opt_a, opt_b, opt_c, opt_d, correct, points, explanation))
    new_q_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'message': 'Question added successfully', 'question_id': new_q_id}), 201

@app.route('/api/faculty/questions/<int:question_id>', methods=['DELETE'])
def faculty_delete_question(question_id):
    if session.get('role') != 'faculty':
        return jsonify({'error': 'Faculty access required'}), 403

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM questions WHERE id = ?', (question_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Question deleted successfully'})

@app.route('/api/faculty/results', methods=['GET'])
def faculty_get_results():
    if session.get('role') != 'faculty':
        return jsonify({'error': 'Faculty access required'}), 403

    quiz_id = request.args.get('quiz_id')
    conn = get_db()
    cursor = conn.cursor()

    if quiz_id:
        cursor.execute('''
            SELECT s.*, q.title as quiz_title, q.passing_percentage
            FROM submissions s
            JOIN quizzes q ON s.quiz_id = q.id
            WHERE s.quiz_id = ?
            ORDER BY s.submitted_at DESC
        ''', (quiz_id,))
    else:
        cursor.execute('''
            SELECT s.*, q.title as quiz_title, q.passing_percentage
            FROM submissions s
            JOIN quizzes q ON s.quiz_id = q.id
            ORDER BY s.submitted_at DESC
        ''')

    rows = cursor.fetchall()
    submissions = [dict_from_row(r) for r in rows]

    # Calculate overall aggregate stats
    total_submissions = len(submissions)
    passed_count = sum(1 for s in submissions if s['passed'])
    avg_percentage = round(sum(s['percentage'] for s in submissions) / total_submissions, 1) if total_submissions > 0 else 0
    highest_percentage = max([s['percentage'] for s in submissions], default=0)

    conn.close()
    return jsonify({
        'submissions': submissions,
        'analytics': {
            'total_submissions': total_submissions,
            'passed_count': passed_count,
            'failed_count': total_submissions - passed_count,
            'avg_percentage': avg_percentage,
            'highest_percentage': highest_percentage,
            'pass_rate': round((passed_count / total_submissions) * 100, 1) if total_submissions > 0 else 0
        }
    })

@app.route('/api/faculty/submissions/<int:submission_id>', methods=['GET'])
def faculty_submission_detail(submission_id):
    if session.get('role') != 'faculty':
        return jsonify({'error': 'Faculty access required'}), 403

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.*, q.title as quiz_title
        FROM submissions s
        JOIN quizzes q ON s.quiz_id = q.id
        WHERE s.id = ?
    ''', (submission_id,))
    sub = dict_from_row(cursor.fetchone())

    if not sub:
        conn.close()
        return jsonify({'error': 'Submission not found'}), 404

    # Fetch quiz questions
    cursor.execute('SELECT * FROM questions WHERE quiz_id = ? ORDER BY id ASC', (sub['quiz_id'],))
    questions = [dict_from_row(r) for r in cursor.fetchall()]
    conn.close()

    answers = json.loads(sub['answers_json'])
    breakdown = []
    for q in questions:
        student_choice = answers.get(str(q['id']))
        is_correct = (student_choice == q['correct_option'])
        breakdown.append({
            'question_id': q['id'],
            'question_text': q['question_text'],
            'option_a': q['option_a'],
            'option_b': q['option_b'],
            'option_c': q['option_c'],
            'option_d': q['option_d'],
            'student_choice': student_choice,
            'correct_option': q['correct_option'],
            'is_correct': is_correct,
            'explanation': q['explanation'],
            'points': q['points']
        })

    sub['breakdown'] = breakdown
    return jsonify({'submission': sub})

# ==========================================
# STUDENT ENDPOINTS
# View Quizzes, Attend Quiz, Close & Submit
# ==========================================

@app.route('/api/student/quizzes', methods=['GET'])
def student_get_quizzes():
    if session.get('role') != 'student':
        return jsonify({'error': 'Student access required'}), 403

    student_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT q.id, q.title, q.description, q.faculty_name, q.time_limit_minutes, q.passing_percentage,
               (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count,
               (SELECT SUM(points) FROM questions WHERE quiz_id = q.id) as total_points,
               (SELECT s.percentage FROM submissions s WHERE s.quiz_id = q.id AND s.student_id = ? ORDER BY s.submitted_at DESC LIMIT 1) as my_last_score,
               (SELECT s.passed FROM submissions s WHERE s.quiz_id = q.id AND s.student_id = ? ORDER BY s.submitted_at DESC LIMIT 1) as my_last_passed,
               (SELECT COUNT(*) FROM submissions s WHERE s.quiz_id = q.id AND s.student_id = ?) as my_attempt_count
        FROM quizzes q
        WHERE q.is_active = 1
        ORDER BY q.created_at DESC
    ''', (student_id, student_id, student_id))

    quizzes = [dict_from_row(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'quizzes': quizzes})

@app.route('/api/student/quizzes/<int:quiz_id>/start', methods=['GET'])
def student_start_quiz(quiz_id):
    if session.get('role') != 'student':
        return jsonify({'error': 'Student access required'}), 403

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM quizzes WHERE id = ? AND is_active = 1', (quiz_id,))
    quiz = dict_from_row(cursor.fetchone())

    if not quiz:
        conn.close()
        return jsonify({'error': 'Quiz not found or is currently closed by faculty'}), 404

    # Fetch questions without revealing correct_option or explanation to student!
    cursor.execute('''
        SELECT id, question_text, option_a, option_b, option_c, option_d, points
        FROM questions
        WHERE quiz_id = ?
        ORDER BY id ASC
    ''', (quiz_id,))
    questions = [dict_from_row(r) for r in cursor.fetchall()]
    conn.close()

    if not questions:
        return jsonify({'error': 'This quiz has no questions yet. Please check back later.'}), 400

    return jsonify({
        'quiz': {
            'id': quiz['id'],
            'title': quiz['title'],
            'description': quiz['description'],
            'faculty_name': quiz['faculty_name'],
            'time_limit_minutes': quiz['time_limit_minutes'],
            'passing_percentage': quiz['passing_percentage'],
            'total_questions': len(questions),
            'total_points': sum(q['points'] for q in questions)
        },
        'questions': questions
    })

@app.route('/api/student/quizzes/<int:quiz_id>/submit', methods=['POST'])
def student_submit_quiz(quiz_id):
    if session.get('role') != 'student':
        return jsonify({'error': 'Student access required'}), 403

    data = request.get_json() or {}
    student_answers = data.get('answers', {}) # format: {"question_id": "A"}
    time_taken = int(data.get('time_taken_seconds', 0))

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM quizzes WHERE id = ?', (quiz_id,))
    quiz = dict_from_row(cursor.fetchone())
    if not quiz:
        conn.close()
        return jsonify({'error': 'Quiz not found'}), 404

    cursor.execute('SELECT * FROM questions WHERE quiz_id = ? ORDER BY id ASC', (quiz_id,))
    questions = [dict_from_row(r) for r in cursor.fetchall()]

    if not questions:
        conn.close()
        return jsonify({'error': 'Quiz has no questions'}), 400

    score = 0
    total_points = 0
    breakdown = []

    for q in questions:
        q_id_str = str(q['id'])
        chosen = student_answers.get(q_id_str)
        is_correct = (chosen == q['correct_option'])
        pts = q['points']
        total_points += pts
        if is_correct:
            score += pts

        breakdown.append({
            'question_id': q['id'],
            'question_text': q['question_text'],
            'option_a': q['option_a'],
            'option_b': q['option_b'],
            'option_c': q['option_c'],
            'option_d': q['option_d'],
            'student_choice': chosen,
            'correct_option': q['correct_option'],
            'is_correct': is_correct,
            'explanation': q['explanation'],
            'points': pts
        })

    percentage = round((score / total_points * 100), 1) if total_points > 0 else 0
    passed = 1 if percentage >= quiz['passing_percentage'] else 0

    student_id = session['user_id']
    student_login_id = session['login_id']
    student_name = session.get('display_name', student_login_id)

    cursor.execute('''
        INSERT INTO submissions (quiz_id, student_id, student_login_id, student_name, score, total_points, percentage, passed, answers_json, time_taken_seconds)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        quiz_id,
        student_id,
        student_login_id,
        student_name,
        score,
        total_points,
        percentage,
        passed,
        json.dumps(student_answers),
        time_taken
    ))
    submission_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        'message': 'Quiz submitted successfully',
        'result': {
            'submission_id': submission_id,
            'quiz_title': quiz['title'],
            'score': score,
            'total_points': total_points,
            'percentage': percentage,
            'passing_percentage': quiz['passing_percentage'],
            'passed': bool(passed),
            'time_taken_seconds': time_taken,
            'breakdown': breakdown
        }
    })

@app.route('/api/student/my-results', methods=['GET'])
def student_my_results():
    if session.get('role') != 'student':
        return jsonify({'error': 'Student access required'}), 403

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.*, q.title as quiz_title, q.passing_percentage
        FROM submissions s
        JOIN quizzes q ON s.quiz_id = q.id
        WHERE s.student_id = ?
        ORDER BY s.submitted_at DESC
    ''', (session['user_id'],))
    submissions = [dict_from_row(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'submissions': submissions})

# ==========================================
# WEB APP FRONTEND
# ==========================================

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    print("Starting Interactive Quiz Maker Platform on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=True)
