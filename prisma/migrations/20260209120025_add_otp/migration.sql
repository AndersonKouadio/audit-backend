-- CreateTable
CREATE TABLE "otp_tokens" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(255) NOT NULL,
    "email" TEXT NOT NULL,
    "counter" INTEGER,
    "expire" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counters_otp" (
    "id" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,

    CONSTRAINT "counters_otp_pkey" PRIMARY KEY ("id")
);
