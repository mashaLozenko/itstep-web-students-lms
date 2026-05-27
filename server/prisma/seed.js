/**
 * Seed script — generates a medium-scale dataset for the LMS Course Catalog.
 * Run: node prisma/seed.js (from server/ directory)
 *
 * Scale:
 *   20 instructors, 200 students
 *   30 courses (mixed statuses, ~70% Published)
 *   Per Published course: 3-5 sections, 3-6 lessons/section, 1-3 assignments/section
 *   500 submissions, ~80% graded
 *   1000 comments (some nested), 50 announcements
 *   100 learning materials, ~300 enrollments
 *   ~20 notifications per student, ~30% lesson progress, ~5 material favorites per student
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { faker, fakerUK } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('Починаємо заповнення бази даних...');

  // ─── Wipe all tables (dependency order) ────────────────────────────────────
  console.log('  Очищення існуючих даних...');
  await prisma.$transaction([
    prisma.materialFavorite.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.grade.deleteMany(),
    prisma.submission.deleteMany(),
    prisma.lessonProgress.deleteMany(),
    prisma.assignment.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.section.deleteMany(),
    prisma.announcement.deleteMany(),
    prisma.learningMaterial.deleteMany(),
    prisma.enrollment.deleteMany(),
    prisma.course.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  console.log('  Очищено.');

  const HASH = await bcrypt.hash('password123', 10);

  // ─── Users ──────────────────────────────────────────────────────────────────
  console.log('  Створення користувачів...');

  // Demo instructor
  const demoInstructor = await prisma.user.create({
    data: {
      email: 'instructor@example.com',
      passwordHash: HASH,
      fullName: 'Демо Викладач',
      role: 'Instructor',
    },
  });

  // Demo student
  const demoStudent = await prisma.user.create({
    data: {
      email: 'student@example.com',
      passwordHash: HASH,
      fullName: 'Демо Студент',
      role: 'Student',
    },
  });

  // Additional instructors
  const instructors = [demoInstructor];
  for (let i = 0; i < 19; i++) {
    const u = await prisma.user.create({
      data: {
        email: faker.internet.email().toLowerCase(),
        passwordHash: HASH,
        fullName: fakerUK.person.fullName(),
        role: 'Instructor',
        avatarUrl: faker.image.avatar(),
      },
    });
    instructors.push(u);
  }

  // Students
  const students = [demoStudent];
  for (let i = 0; i < 199; i++) {
    const u = await prisma.user.create({
      data: {
        email: faker.internet.email().toLowerCase(),
        passwordHash: HASH,
        fullName: fakerUK.person.fullName(),
        role: 'Student',
        avatarUrl: faker.datatype.boolean(0.6) ? faker.image.avatar() : null,
      },
    });
    students.push(u);
  }
  console.log(`  Створено ${instructors.length} викладачів, ${students.length} студентів.`);

  // ─── Courses ────────────────────────────────────────────────────────────────
  console.log('  Створення курсів...');
  const statuses = ['Published', 'Published', 'Published', 'Published', 'Published', 'Published', 'Published', 'Draft', 'Draft', 'Archived'];
  const courseAdjectives = ['Сучасний', 'Практичний', 'Поглиблений', 'Базовий', 'Прикладний', 'Комплексний', 'Інтенсивний'];
  const courseNouns = ['Аналіз', 'Програмування', 'Дизайн', 'Менеджмент', 'Алгоритми', 'Архітектура', 'Математика'];
  const courseSuffixes = ['Основи', 'Майстер-клас', 'Воркшоп', 'Буткемп', 'Поглиблений курс', 'Практикум', 'Огляд'];
  const semesters = ['2025-Fall', '2026-Spring', '2026-Fall', '2027-Spring'];
  const finalControls = ['Exam', 'Exam', 'Exam', 'GradedPass', 'Pass'];
  const ectsOptions = [3, 4, 5, 5, 5, 6, 7, 8];
  const courses = [];
  for (let i = 0; i < 30; i++) {
    const instructor = pick(instructors);
    const slug = faker.string.alphanumeric(8).toLowerCase();
    const c = await prisma.course.create({
      data: {
        title: `${pick(courseAdjectives)} ${pick(courseNouns)}: ${pick(courseSuffixes)}`,
        description: fakerUK.lorem.paragraphs(2),
        instructorId: instructor.id,
        status: pick(statuses),
        creditsEcts: pick(ectsOptions),
        semester: pick(semesters),
        finalControl: pick(finalControls),
        syllabusUrl: Math.random() < 0.7 ? `https://syllabi.university.example/${slug}.pdf` : null,
        createdAt: faker.date.past({ years: 1 }),
      },
    });
    courses.push({ ...c, instructorId: instructor.id });
  }
  console.log(`  Створено ${courses.length} курсів.`);

  const publishedCourses = courses.filter((c) => c.status === 'Published');

  // ─── Enrollments (~300, mostly Approved) ──────────────────────────────────
  console.log('  Створення записів на курси...');
  const enrolledPairs = new Set();
  const enrollmentsByCourse = {};
  let enrollmentCount = 0;

  for (const course of publishedCourses) {
    enrollmentsByCourse[course.id] = [];
  }

  // Ensure demo student is enrolled in first 6 published courses (+1 Pending)
  const demoStudentCourses = [];
  for (let i = 0; i < Math.min(6, publishedCourses.length); i++) {
    const course = publishedCourses[i];
    const key = `${demoStudent.id}:${course.id}`;
    if (!enrolledPairs.has(key)) {
      await prisma.enrollment.create({
        data: {
          userId: demoStudent.id,
          courseId: course.id,
          status: i === 5 ? 'Pending' : 'Approved',
        },
      });
      enrolledPairs.add(key);
      enrollmentsByCourse[course.id].push(demoStudent.id);
      enrollmentCount++;
      if (i !== 5) demoStudentCourses.push(course);
    }
  }

  // Random enrollments up to ~300 total
  let attempts = 0;
  while (enrollmentCount < 300 && attempts < 3000) {
    attempts++;
    const student = pick(students);
    const course = pick(publishedCourses);
    const key = `${student.id}:${course.id}`;
    if (enrolledPairs.has(key)) continue;

    const status = Math.random() < 0.9 ? 'Approved' : 'Pending';
    await prisma.enrollment.create({
      data: {
        userId: student.id,
        courseId: course.id,
        status,
        createdAt: faker.date.between({ from: course.createdAt, to: new Date() }),
      },
    });
    enrolledPairs.add(key);
    if (enrollmentsByCourse[course.id]) {
      enrollmentsByCourse[course.id].push(student.id);
    }
    enrollmentCount++;
  }
  console.log(`  Створено ${enrollmentCount} записів на курси.`);

  // ─── Sections, Lessons, Assignments ────────────────────────────────────────
  console.log('  Створення розділів, уроків та завдань...');
  const allLessons = [];
  const allAssignments = [];
  const sectionPrefixes = ['Модуль', 'Розділ', 'Блок', 'Частина'];
  const assignmentKinds = [
    'Лабораторна', 'Практична', 'Контрольна', 'Реферат', 'Проєкт',
    'Тест', 'Колоквіум', 'Есе', 'Дослідження', 'Кейс',
  ];

  for (const course of publishedCourses) {
    const numSections = randInt(3, 5);
    for (let si = 0; si < numSections; si++) {
      const section = await prisma.section.create({
        data: {
          courseId: course.id,
          title: `${pick(sectionPrefixes)} ${si + 1}: ${fakerUK.company.buzzPhrase()}`,
          order: si,
          createdAt: faker.date.between({ from: course.createdAt, to: new Date() }),
        },
      });

      const numLessons = randInt(3, 6);
      for (let li = 0; li < numLessons; li++) {
        const lessonTitle = fakerUK.company.catchPhrase();
        const lesson = await prisma.lesson.create({
          data: {
            sectionId: section.id,
            title: lessonTitle,
            contentMarkdown: `# ${lessonTitle}\n\n${fakerUK.lorem.paragraphs(4)}\n\n## Ключові концепції\n\n${fakerUK.lorem.paragraphs(2)}\n\n## Підсумок\n\n${fakerUK.lorem.paragraph()}`,
            releaseAt: Math.random() < 0.2 ? faker.date.soon({ days: 30 }) : null,
            order: li,
            createdAt: faker.date.between({ from: section.createdAt, to: new Date() }),
          },
        });
        allLessons.push({ ...lesson, courseId: course.id, sectionOrder: si });
      }

      const numAssignments = randInt(1, 3);
      for (let ai = 0; ai < numAssignments; ai++) {
        const createdAt = faker.date.between({ from: section.createdAt, to: new Date() });
        const assignment = await prisma.assignment.create({
          data: {
            sectionId: section.id,
            title: `${pick(assignmentKinds)} ${ai + 1}`,
            descriptionMarkdown: `## Огляд\n\n${fakerUK.lorem.paragraphs(2)}\n\n## Вимоги\n\n- ${fakerUK.lorem.sentence()}\n- ${fakerUK.lorem.sentence()}\n- ${fakerUK.lorem.sentence()}\n\n## Здача\n\n${fakerUK.lorem.paragraph()}`,
            dueAt: faker.date.soon({ days: 60, refDate: createdAt }),
            releaseAt: Math.random() < 0.3 ? createdAt : null,
            maxScore: pick([50, 75, 100, 100, 100, 150, 200]),
            createdAt,
          },
        });
        allAssignments.push({ ...assignment, courseId: course.id });
      }
    }
  }
  console.log(`  Створено ${allLessons.length} уроків, ${allAssignments.length} завдань.`);

  // ─── Submissions (~500) ─────────────────────────────────────────────────────
  console.log('  Створення зданих робіт...');
  const submittedPairs = new Set();
  const submissions = [];
  let subAttempts = 0;

  while (submissions.length < 500 && subAttempts < 5000) {
    subAttempts++;
    const assignment = pick(allAssignments);
    const courseStudents = enrollmentsByCourse[assignment.courseId];
    if (!courseStudents || courseStudents.length === 0) continue;
    const studentId = pick(courseStudents);
    const key = `${assignment.id}:${studentId}`;
    if (submittedPairs.has(key)) continue;

    const sub = await prisma.submission.create({
      data: {
        assignmentId: assignment.id,
        userId: studentId,
        textBody: Math.random() < 0.7 ? fakerUK.lorem.paragraphs(2) : null,
        fileUrl: Math.random() < 0.4 ? `/uploads/sample-${faker.string.alphanumeric(8)}.pdf` : null,
        submittedAt: faker.date.between({ from: assignment.createdAt, to: new Date() }),
      },
    });
    submittedPairs.add(key);
    submissions.push({ ...sub, courseId: assignment.courseId });
  }
  console.log(`  Створено ${submissions.length} зданих робіт.`);

  // ─── Grades (~80% of submissions) ──────────────────────────────────────────
  console.log('  Створення оцінок...');
  let gradeCount = 0;
  for (const sub of submissions) {
    if (Math.random() < 0.8) {
      // Find instructor for the course
      const course = courses.find((c) => c.id === sub.courseId);
      if (!course) continue;

      await prisma.grade.create({
        data: {
          submissionId: sub.id,
          score: randInt(0, 100),
          instructorId: course.instructorId,
          gradedAt: faker.date.between({ from: sub.submittedAt, to: new Date() }),
        },
      });
      gradeCount++;
    }
  }
  console.log(`  Створено ${gradeCount} оцінок.`);

  // ─── Comments (~1000, some nested) ─────────────────────────────────────────
  console.log('  Створення коментарів...');
  let commentCount = 0;

  // Grades with comments
  const gradedSubmissions = submissions.filter((_, i) => i < gradeCount);
  const grades = await prisma.grade.findMany({ take: 200 });

  for (let i = 0; i < Math.min(400, grades.length * 2); i++) {
    const grade = pick(grades);
    const sub = submissions.find((s) => s.id === grade.submissionId);
    if (!sub) continue;
    const author = Math.random() < 0.5 ? { id: sub.userId } : pick(instructors);

    try {
      const c = await prisma.comment.create({
        data: {
          authorId: author.id,
          parentType: 'Grade',
          parentId: grade.id,
          body: fakerUK.lorem.sentences(randInt(1, 3)),
          createdAt: faker.date.between({ from: grade.gradedAt, to: new Date() }),
        },
      });
      commentCount++;

      // ~20% chance of a reply
      if (Math.random() < 0.2) {
        const replier = Math.random() < 0.5 ? { id: sub.userId } : pick(instructors);
        await prisma.comment.create({
          data: {
            authorId: replier.id,
            parentType: 'Grade',
            parentId: grade.id,
            parentCommentId: c.id,
            body: fakerUK.lorem.sentences(1),
            createdAt: faker.date.between({ from: c.createdAt, to: new Date() }),
          },
        });
        commentCount++;
      }
    } catch (_) { /* skip on constraint violations */ }
  }

  // Lesson comments
  const lessonSample = pickN(allLessons, 100);
  for (const lesson of lessonSample) {
    const courseStudents = enrollmentsByCourse[lesson.courseId] || [];
    if (courseStudents.length === 0) continue;
    const numComments = randInt(1, 5);
    const topLevelComments = [];

    for (let j = 0; j < numComments; j++) {
      const authorId = Math.random() < 0.8 ? pick(courseStudents) : pick(instructors).id;
      try {
        const c = await prisma.comment.create({
          data: {
            authorId,
            parentType: 'Lesson',
            parentId: lesson.id,
            body: fakerUK.lorem.sentences(randInt(1, 4)),
            createdAt: faker.date.between({ from: lesson.createdAt, to: new Date() }),
          },
        });
        topLevelComments.push(c);
        commentCount++;
      } catch (_) { /* skip */ }
    }

    // Some replies
    if (topLevelComments.length > 0 && Math.random() < 0.3) {
      const parentComment = pick(topLevelComments);
      const authorId = Math.random() < 0.5 ? pick(courseStudents) : pick(instructors).id;
      try {
        await prisma.comment.create({
          data: {
            authorId,
            parentType: 'Lesson',
            parentId: lesson.id,
            parentCommentId: parentComment.id,
            body: fakerUK.lorem.sentence(),
            createdAt: faker.date.between({ from: parentComment.createdAt, to: new Date() }),
          },
        });
        commentCount++;
      } catch (_) { /* skip */ }
    }
  }
  console.log(`  Створено ${commentCount} коментарів.`);

  // ─── Announcements (~50) ────────────────────────────────────────────────────
  console.log('  Створення оголошень...');
  let announcementCount = 0;
  for (let i = 0; i < 50; i++) {
    const course = pick(publishedCourses);
    await prisma.announcement.create({
      data: {
        courseId: course.id,
        instructorId: course.instructorId,
        title: fakerUK.company.catchPhrase(),
        body: fakerUK.lorem.paragraphs(2),
        createdAt: faker.date.between({ from: course.createdAt, to: new Date() }),
      },
    });
    announcementCount++;
  }
  console.log(`  Створено ${announcementCount} оголошень.`);

  // ─── Learning Materials (~100) ──────────────────────────────────────────────
  console.log('  Створення навчальних матеріалів...');
  const materialKinds = ['Video', 'Video', 'Link', 'Link', 'File'];
  const materialSuffixes = ['Посібник', 'Туторіал', 'Довідник', 'Шпаргалка', 'Відеолекція', 'Стаття'];
  const materialsList = [];
  for (let i = 0; i < 100; i++) {
    const kind = pick(materialKinds);
    const creator = pick(instructors);
    const m = await prisma.learningMaterial.create({
      data: {
        title: `${fakerUK.company.buzzAdjective()} ${fakerUK.company.buzzNoun()}: ${pick(materialSuffixes)}`,
        kind,
        url: kind !== 'File' ? faker.internet.url() : null,
        fileUrl: kind === 'File' ? `/uploads/material-${faker.string.alphanumeric(8)}.pdf` : null,
        description: fakerUK.lorem.paragraph(),
        creatorId: creator.id,
        createdAt: faker.date.past({ years: 1 }),
      },
    });
    materialsList.push(m);
  }
  console.log(`  Створено ${materialsList.length} навчальних матеріалів.`);

  // ─── Material Favorites (~5 per student) ────────────────────────────────────
  console.log('  Створення вибраних матеріалів...');
  let favCount = 0;
  const favPairs = new Set();
  for (const student of students) {
    const favMaterials = pickN(materialsList, 5);
    for (const m of favMaterials) {
      const key = `${student.id}:${m.id}`;
      if (favPairs.has(key)) continue;
      await prisma.materialFavorite.create({
        data: { userId: student.id, materialId: m.id },
      });
      favPairs.add(key);
      favCount++;
    }
  }
  console.log(`  Створено ${favCount} вибраних матеріалів.`);

  // ─── Lesson Progress (~30% of lessons per enrolled student) ─────────────────
  console.log('  Створення прогресу уроків...');
  let progressCount = 0;
  const progressPairs = new Set();

  for (const course of publishedCourses) {
    const courseStudents = enrollmentsByCourse[course.id] || [];
    const courseLessons = allLessons.filter((l) => l.courseId === course.id);
    if (courseLessons.length === 0) continue;

    for (const studentId of courseStudents) {
      const numToComplete = Math.floor(courseLessons.length * 0.3);
      const toComplete = pickN(courseLessons, numToComplete);
      for (const lesson of toComplete) {
        const key = `${studentId}:${lesson.id}`;
        if (progressPairs.has(key)) continue;
        await prisma.lessonProgress.create({
          data: {
            userId: studentId,
            lessonId: lesson.id,
            completedAt: faker.date.between({ from: lesson.createdAt, to: new Date() }),
          },
        });
        progressPairs.add(key);
        progressCount++;
      }
    }
  }
  console.log(`  Створено ${progressCount} записів прогресу уроків.`);

  // ─── Demo Student: explicit submissions, grades, comments, progress ─────────
  console.log('  Створення даних для Demo Student...');
  const demoAssignments = allAssignments.filter((a) => demoStudentCourses.some((c) => c.id === a.courseId));
  let demoSubCount = 0;
  let demoGradeCount = 0;
  for (const assignment of demoAssignments.slice(0, 15)) {
    const subKey = `${assignment.id}:${demoStudent.id}`;
    if (submittedPairs.has(subKey)) continue;
    const submittedAt = faker.date.between({ from: assignment.createdAt, to: new Date() });
    const sub = await prisma.submission.create({
      data: {
        assignmentId: assignment.id,
        userId: demoStudent.id,
        textBody: fakerUK.lorem.paragraphs(2),
        fileUrl: Math.random() < 0.5 ? `/uploads/sample-${faker.string.alphanumeric(8)}.pdf` : null,
        submittedAt,
      },
    });
    submittedPairs.add(subKey);
    demoSubCount++;

    if (Math.random() < 0.8) {
      const course = courses.find((c) => c.id === assignment.courseId);
      const grade = await prisma.grade.create({
        data: {
          submissionId: sub.id,
          score: randInt(60, 100),
          instructorId: course.instructorId,
          gradedAt: faker.date.between({ from: submittedAt, to: new Date() }),
        },
      });
      demoGradeCount++;

      // Add an instructor comment on the grade
      if (Math.random() < 0.7) {
        await prisma.comment.create({
          data: {
            authorId: course.instructorId,
            parentType: 'Grade',
            parentId: grade.id,
            body: pick([
              'Гарна робота! Можна було б додати більше деталей у частині другій.',
              'Молодець, тема розкрита. Перевір типографіку.',
              'Загалом непогано, але є моменти для покращення.',
              'Чудовий аналіз. Тримай так.',
            ]),
            createdAt: faker.date.between({ from: grade.gradedAt, to: new Date() }),
          },
        });
      }
    }
  }
  console.log(`  Demo Student: ${demoSubCount} зданих робіт, ${demoGradeCount} оцінок.`);

  // Demo Student: lesson progress in enrolled courses (~50% of lessons)
  let demoProgress = 0;
  for (const course of demoStudentCourses) {
    const courseLessons = allLessons.filter((l) => l.courseId === course.id);
    const toComplete = pickN(courseLessons, Math.floor(courseLessons.length * 0.5));
    for (const lesson of toComplete) {
      const key = `${demoStudent.id}:${lesson.id}`;
      if (progressPairs.has(key)) continue;
      await prisma.lessonProgress.create({
        data: {
          userId: demoStudent.id,
          lessonId: lesson.id,
          completedAt: faker.date.between({ from: lesson.createdAt, to: new Date() }),
        },
      });
      progressPairs.add(key);
      demoProgress++;
    }
  }
  console.log(`  Demo Student: ${demoProgress} пройдених уроків.`);

  // Demo Student: favorite 12 materials
  let demoFavs = 0;
  for (const m of pickN(materialsList, 12)) {
    const key = `${demoStudent.id}:${m.id}`;
    if (favPairs.has(key)) continue;
    await prisma.materialFavorite.create({ data: { userId: demoStudent.id, materialId: m.id } });
    favPairs.add(key);
    demoFavs++;
  }
  console.log(`  Demo Student: ${demoFavs} вибраних матеріалів.`);

  // ─── Demo Instructor: owns 4 courses with rich data ─────────────────────────
  console.log('  Створення додаткових даних для Demo Instructor...');
  // Re-assign 4 published courses to demo instructor if not already
  const reassignedCourses = [];
  for (const course of publishedCourses.slice(0, 4)) {
    if (course.instructorId !== demoInstructor.id) {
      await prisma.course.update({ where: { id: course.id }, data: { instructorId: demoInstructor.id } });
      course.instructorId = demoInstructor.id;
    }
    reassignedCourses.push(course);
  }

  // Add 5 announcements from Demo Instructor across their courses
  for (let i = 0; i < 5; i++) {
    const course = pick(reassignedCourses);
    await prisma.announcement.create({
      data: {
        courseId: course.id,
        instructorId: demoInstructor.id,
        title: pick([
          'Зміна дедлайну для лабораторної',
          'Запис семінару доступний',
          'Нова література в бібліотеці',
          'Консультація у п\'ятницю',
          'Результати модульного контролю',
        ]),
        body: fakerUK.lorem.paragraphs(2),
        createdAt: faker.date.recent({ days: 14 }),
      },
    });
  }
  console.log(`  Demo Instructor: 5 оголошень, ${reassignedCourses.length} власних курсів.`);

  // ─── Notifications (~20 per student) ────────────────────────────────────────
  console.log('  Створення сповіщень...');
  const notifKinds = ['grade_posted', 'comment_added', 'announcement_published'];
  let notifCount = 0;
  for (const student of students) {
    for (let i = 0; i < 20; i++) {
      await prisma.notification.create({
        data: {
          userId: student.id,
          kind: pick(notifKinds),
          payloadJson: JSON.stringify({ message: fakerUK.lorem.sentence() }),
          readAt: Math.random() < 0.5 ? faker.date.recent({ days: 7 }) : null,
          createdAt: faker.date.recent({ days: 30 }),
        },
      });
      notifCount++;
    }
  }
  console.log(`  Створено ${notifCount} сповіщень.`);

  console.log('\nЗаповнення бази даних завершено!');
  console.log('\nДемо-облікові записи:');
  console.log('  Викладач: instructor@example.com / password123');
  console.log('  Студент:  student@example.com    / password123');
}

main()
  .catch((e) => {
    console.error('Помилка заповнення бази даних:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
