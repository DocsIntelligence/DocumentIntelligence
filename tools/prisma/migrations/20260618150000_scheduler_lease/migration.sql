-- CreateTable
CREATE TABLE "SchedulerLease" (
    "name" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerLease_pkey" PRIMARY KEY ("name")
);
