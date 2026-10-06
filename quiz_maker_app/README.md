# ⚡ QuizCraft — Interactive Faculty & Student Assessment Platform

A high-interaction, streamlined Quiz Application built for educators and students. Designed with a creator aesthetic, tactile audio feedback, live countdown timers, instantaneous auto-grading, and zero-friction authentication.

---

## 🌟 Key Features

### 🔐 Frictionless Authentication (Pure Login ID & Password Only)
- **Zero bloat**: No email address, no phone number, and no captchas required.
- Students and Faculty log in or create an account with **only their Login ID and Password**.
- Instant 1-Click Demo Logins included for quick previewing:
  - **Faculty Demo**: ID: `prof_nexus` | Password: `faculty123`
  - **Student Demo**: ID: `alex_dev` | Password: `student123`
  - **Student Demo 2**: ID: `sarah_code` | Password: `student123`

---

### 👨‍🏫 Faculty Dashboard
1. **Interactive Quiz Creator**:
   - Set Quiz Title, Description, Duration/Time Limit in minutes, and Passing Percentage.
2. **Interactive Question Studio**:
   - Add multiple-choice questions (Options A, B, C, D) with instantaneous live preview card.
   - Select the correct answer with radio buttons, assign points, and provide an explanation.
   - Delete, inspect, and manage questions in real-time.
3. **Live Status Toggling**:
   - Activate or Pause/Deactivate quizzes at will so students can only take them when allowed.
4. **Comprehensive Class Results & Gradebook**:
   - Class-wide analytics: Average score percentage, total submissions, and pass rate.
   - Filter results by quiz or search by student name/ID.
   - **Inspect Submission**: Review question-by-question breakdown of what the student selected vs the correct answer, complete with timestamps and durations.

---

### 🎓 Student Dashboard & Quiz Arena
1. **Available Quizzes**:
   - View all active quizzes, faculty instructor details, question count, and duration.
   - Badge indicators showing previous attempts and scores.
2. **Interactive Quiz Arena ("Attending the Quiz")**:
   - **Live Countdown Timer**: Circular/pill timer that turns amber under 2 minutes and pulses red with ticking audio when under 30 seconds. Automatically submits when time expires.
   - **Interactive Question Stepper**: Jump directly to any question with color-coded answered, current, and unanswered states.
   - **Option Selection**: Tactile response, crisp hover glows, and sound effects.
   - **Close Quiz Modal**: Confirm before exiting with clear warnings to prevent accidental abandonment.
   - **Review & Submit Modal**: Summary of answered vs unanswered questions before final submission.
3. **Post-Quiz Interactive Scorecard**:
   - Confetti blast & fanfare on passing!
   - Instant score and accuracy percentage.
   - Detailed review showing every question, what you picked (green check if right, red cross if wrong), the correct answer, and faculty's explanation note.

---

### 🎵 Maker & Creator Touches
- **Web Audio API Synthesizer**: Zero external audio file dependencies. Real synthesized sounds for clicks, option selection, warning alerts, ticking timers, and completion fanfare. Toggleable mute button.
- **Glassmorphism Cyber Theme**: Built with Tailwind CSS, Lucide icons, and custom CSS glow effects.

---

## 🚀 How to Run

1. Open PowerShell or Command Prompt.
2. Navigate to the project directory:
   ```powershell
   cd C:\Users\mjhan\.gemini\antigravity\scratch\quiz_maker_app
   ```
3. Run the application:
   ```powershell
   python app.py
   ```
4. Open your browser and navigate to:
   ```
   http://127.0.0.1:5000
   ```
