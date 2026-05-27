import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './layout/AppShell.jsx'
import { RequireAuth } from './auth/RequireAuth.jsx'
import { RequireRole } from './auth/RequireRole.jsx'
import { useAuth } from './auth/useAuth.js'

// Auth (повністю реалізовані — не чіпайте)
import { Login } from './routes/auth/Login.jsx'
import { Register } from './routes/auth/Register.jsx'

// Внутрішні екрани — заглушки, реалізуйте їх самостійно
import { CourseCatalog } from './routes/catalog/CourseCatalog.jsx'
import { CourseDetail } from './routes/catalog/CourseDetail.jsx'
import { CourseBuilder } from './routes/builder/CourseBuilder.jsx'
import { CourseStudents } from './routes/enrollments/CourseStudents.jsx'
import { LessonView } from './routes/lesson/LessonView.jsx'
import { LessonEdit } from './routes/lesson/LessonEdit.jsx'
import { AssignmentView } from './routes/assignment/AssignmentView.jsx'
import { AssignmentSubmit } from './routes/assignment/AssignmentSubmit.jsx'
import { SubmissionsList } from './routes/grading/SubmissionsList.jsx'
import { GradeSubmission } from './routes/grading/GradeSubmission.jsx'
import { CourseGradebook } from './routes/gradebook/CourseGradebook.jsx'
import { MyGrades } from './routes/gradebook/MyGrades.jsx'
import { StudentDashboard } from './routes/dashboard/StudentDashboard.jsx'
import { InstructorDashboard } from './routes/dashboard/InstructorDashboard.jsx'
import { Announcements } from './routes/communications/Announcements.jsx'
import { CalendarView } from './routes/calendar/CalendarView.jsx'
import { MaterialsLibrary } from './routes/library/MaterialsLibrary.jsx'
import { Profile } from './routes/profile/Profile.jsx'
import { Notifications } from './routes/profile/Notifications.jsx'
import { UsersList } from './routes/users/UsersList.jsx'

function DashboardRedirect() {
  const { user } = useAuth()
  if (user?.role === 'Instructor') return <Navigate to="/dashboard/instructor" replace />
  return <Navigate to="/dashboard/student" replace />
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected — у спільному лейауті з бічною панеллю */}
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardRedirect />} />
        <Route path="/dashboard/student" element={<StudentDashboard />} />
        <Route path="/dashboard/instructor" element={<RequireRole role="Instructor"><InstructorDashboard /></RequireRole>} />

        <Route path="/courses" element={<CourseCatalog />} />
        <Route path="/courses/:courseId" element={<CourseDetail />} />
        <Route path="/courses/:courseId/build" element={<RequireRole role="Instructor"><CourseBuilder /></RequireRole>} />
        <Route path="/courses/:courseId/students" element={<RequireRole role="Instructor"><CourseStudents /></RequireRole>} />
        <Route path="/courses/:courseId/announcements" element={<Announcements />} />
        <Route path="/courses/:courseId/gradebook" element={<RequireRole role="Instructor"><CourseGradebook /></RequireRole>} />
        <Route path="/courses/:courseId/submissions" element={<RequireRole role="Instructor"><SubmissionsList /></RequireRole>} />

        <Route path="/lessons/:lessonId" element={<LessonView />} />
        <Route path="/lessons/:lessonId/edit" element={<RequireRole role="Instructor"><LessonEdit /></RequireRole>} />

        <Route path="/assignments/:assignmentId" element={<AssignmentView />} />
        <Route path="/assignments/:assignmentId/submit" element={<RequireRole role="Student"><AssignmentSubmit /></RequireRole>} />

        <Route path="/submissions" element={<RequireRole role="Instructor"><SubmissionsList /></RequireRole>} />
        <Route path="/submissions/:submissionId/grade" element={<RequireRole role="Instructor"><GradeSubmission /></RequireRole>} />
        <Route path="/grades" element={<RequireRole role="Student"><MyGrades /></RequireRole>} />
        <Route path="/gradebook" element={<RequireRole role="Instructor"><CourseGradebook /></RequireRole>} />

        <Route path="/calendar" element={<CalendarView />} />
        <Route path="/library" element={<MaterialsLibrary />} />
        <Route path="/users" element={<RequireRole role="Instructor"><UsersList /></RequireRole>} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
