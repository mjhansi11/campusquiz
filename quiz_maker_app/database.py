import sqlite3
import os
import json
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = os.path.join(os.path.dirname(__file__), 'quiz_app.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Users table (only login_id and password required)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login_id TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('faculty', 'student')),
        display_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Quizzes table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS quizzes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        faculty_id INTEGER NOT NULL,
        faculty_name TEXT NOT NULL,
        time_limit_minutes INTEGER DEFAULT 10,
        passing_percentage INTEGER DEFAULT 60,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (faculty_id) REFERENCES users (id)
    )
    ''')

    # Questions table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quiz_id INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_option TEXT NOT NULL CHECK(correct_option IN ('A', 'B', 'C', 'D')),
        points INTEGER DEFAULT 1,
        explanation TEXT,
        FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE
    )
    ''')

    # Submissions table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quiz_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        student_login_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        score INTEGER NOT NULL,
        total_points INTEGER NOT NULL,
        percentage REAL NOT NULL,
        passed INTEGER NOT NULL,
        answers_json TEXT NOT NULL,
        time_taken_seconds INTEGER DEFAULT 0,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users (id)
    )
    ''')

    conn.commit()

    # Seed initial demo accounts and sample quiz if empty
    cursor.execute('SELECT COUNT(*) FROM users')
    if cursor.fetchone()[0] == 0:
        # Pre-seed Faculty & Student demo accounts
        faculty_pass = generate_password_hash('faculty123')
        student_pass1 = generate_password_hash('student123')
        student_pass2 = generate_password_hash('student123')

        cursor.execute('''
            INSERT INTO users (login_id, password_hash, role, display_name)
            VALUES (?, ?, ?, ?)
        ''', ('prof_nexus', faculty_pass, 'faculty', 'Prof. Nexus'))
        faculty_id = cursor.lastrowid

        cursor.execute('''
            INSERT INTO users (login_id, password_hash, role, display_name)
            VALUES (?, ?, ?, ?)
        ''', ('alex_dev', student_pass1, 'student', 'Alex Dev'))
        student_id1 = cursor.lastrowid

        cursor.execute('''
            INSERT INTO users (login_id, password_hash, role, display_name)
            VALUES (?, ?, ?, ?)
        ''', ('sarah_code', student_pass2, 'student', 'Sarah Code'))
        student_id2 = cursor.lastrowid

        # Seed Sample Quiz 1: Full-Stack Web Architecture
        cursor.execute('''
            INSERT INTO quizzes (title, description, faculty_id, faculty_name, time_limit_minutes, passing_percentage, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            'Web Architecture & API Essentials',
            'Comprehensive assessment on REST APIs, HTTP methods, client-server models, and web performance.',
            faculty_id,
            'Prof. Nexus',
            5,
            60,
            1
        ))
        quiz_id1 = cursor.lastrowid

        sample_questions1 = [
            (
                quiz_id1,
                'Which HTTP status code signifies that a resource was successfully created on the server?',
                '200 OK',
                '201 Created',
                '204 No Content',
                '301 Moved Permanently',
                'B',
                1,
                'HTTP 201 Created indicates that the request has succeeded and led to the creation of a new resource.'
            ),
            (
                quiz_id1,
                'What is the primary difference between synchronous and asynchronous request processing?',
                'Synchronous processes operate over UDP only',
                'Asynchronous processing blocks user interactions until complete',
                'Asynchronous execution allows other operations to run while waiting for I/O completion',
                'There is no functional performance difference',
                'C',
                1,
                'Asynchronous programming prevents thread blocking during network and disk I/O.'
            ),
            (
                quiz_id1,
                'Which data format is native to JavaScript and the standard for modern RESTful web APIs?',
                'XML',
                'YAML',
                'JSON',
                'Protocol Buffers',
                'C',
                1,
                'JSON (JavaScript Object Notation) is lightweight and natively supported across all modern browsers.'
            ),
            (
                quiz_id1,
                'What is the role of an idempotent HTTP method?',
                'A method that can be called multiple times producing the exact same side-effects as a single call',
                'A method that only works over HTTPS encryption',
                'A method that modifies the database on every invocation',
                'A method that requires token-based authentication',
                'A',
                1,
                'Methods like GET, PUT, and DELETE are idempotent; repeating the request yields identical state.'
            ),
            (
                quiz_id1,
                'Why is client-side input validation considered insufficient for web security?',
                'Browsers cannot evaluate regular expressions',
                'Client-side checks can be bypassed or disabled via devtools or direct HTTP requests',
                'It slows down server processing speed',
                'Databases do not accept validated client JSON',
                'B',
                1,
                'All user input must be sanitized and validated server-side because clients can be manipulated.'
            )
        ]

        for q in sample_questions1:
            cursor.execute('''
                INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, points, explanation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', q)

        # Seed Sample Quiz 2: Python Mastery Sprint
        cursor.execute('''
            INSERT INTO quizzes (title, description, faculty_id, faculty_name, time_limit_minutes, passing_percentage, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            'Python Data Structures & Logic Sprint',
            'Test your fluency with Python lists, dictionaries, complexity, and idiomatic patterns.',
            faculty_id,
            'Prof. Nexus',
            4,
            75,
            1
        ))
        quiz_id2 = cursor.lastrowid

        sample_questions2 = [
            (
                quiz_id2,
                'What is the average time complexity for key lookup in a Python dictionary (hash map)?',
                'O(1)',
                'O(n)',
                'O(log n)',
                'O(n²)',
                'A',
                1,
                'Python dictionaries use hash tables, offering constant average time O(1) for lookups.'
            ),
            (
                quiz_id2,
                'Which of the following data structures in Python is strictly IMMUTABLE?',
                'list',
                'dict',
                'set',
                'tuple',
                'D',
                1,
                'Tuples cannot be altered once instantiated, making them immutable and hashable.'
            ),
            (
                quiz_id2,
                'What does the `yield` keyword in a Python function create?',
                'A recursive call stack',
                'A generator iterator',
                'A lambda closure',
                'A global process thread',
                'B',
                1,
                'Functions with `yield` return a generator object which computes values lazily on demand.'
            )
        ]

        for q in sample_questions2:
            cursor.execute('''
                INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, points, explanation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', q)

        # Seed a sample previous submission from Sarah Code to demonstrate the results dashboard immediately
        sarah_answers = json.dumps({
            "1": "B",
            "2": "C",
            "3": "C",
            "4": "A",
            "5": "A"  # 1 wrong answer (scored 4/5)
        })
        cursor.execute('''
            INSERT INTO submissions (quiz_id, student_id, student_login_id, student_name, score, total_points, percentage, passed, answers_json, time_taken_seconds)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            quiz_id1,
            student_id2,
            'sarah_code',
            'Sarah Code',
            4,
            5,
            80.0,
            1,
            sarah_answers,
            142
        ))

        conn.commit()

    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully with sample quizzes and accounts.")
