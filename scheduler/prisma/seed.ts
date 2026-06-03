import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Seeds one realistic event type modelled on the existing Calendly page
// referenced in SPEC §3.9 (職能：資深人才招募專員 / JIRA690 / Interviewer 黃琬心).
async function main() {
  const interviewer = await prisma.interviewer.upsert({
    where: { email: "wanxin.huang@cmoney.com.tw" },
    update: { name: "黃琬心" },
    create: { name: "黃琬心", email: "wanxin.huang@cmoney.com.tw" },
  });

  // Weekly availability (COMPANY_TZ): Mon/Wed/Fri.
  await prisma.availability.deleteMany({
    where: { interviewerId: interviewer.id },
  });
  await prisma.availability.createMany({
    data: [
      { interviewerId: interviewer.id, dayOfWeek: 1, startTime: "10:00", endTime: "12:00" },
      { interviewerId: interviewer.id, dayOfWeek: 3, startTime: "14:00", endTime: "17:00" },
      { interviewerId: interviewer.id, dayOfWeek: 5, startTime: "10:00", endTime: "12:00" },
    ],
  });

  const existing = await prisma.eventType.findUnique({
    where: { slug: "senior-recruiter-jira690" },
  });

  if (!existing) {
    const eventType = await prisma.eventType.create({
      data: {
        slug: "senior-recruiter-jira690",
        title: "職能：資深人才招募專員",
        jiraKey: "JIRA690",
        durationMin: 60,
        locationType: "phone",
        instructionsMd:
          "預約面試請填中文姓名\nEmail 請與 104 履歷一致\n此關卡會致電進行\nInterviewer：黃琬心",
        minNoticeHours: 12,
        bookingWindowDays: 30,
        assignment: "single",
        active: true,
      },
    });
    await prisma.eventTypeInterviewer.create({
      data: { eventTypeId: eventType.id, interviewerId: interviewer.id },
    });
    console.log(`Seeded event type: /${eventType.slug}`);
  } else {
    console.log("Event type already seeded, skipping.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
