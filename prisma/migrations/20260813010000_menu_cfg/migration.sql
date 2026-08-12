-- CreateTable
CREATE TABLE "MenuGrupoCfg" (
    "clave" TEXT NOT NULL,
    "label" TEXT,
    "icon" TEXT,
    "orden" INTEGER,
    "visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MenuGrupoCfg_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "MenuItemCfg" (
    "href" TEXT NOT NULL,
    "label" TEXT,
    "grupoClave" TEXT,
    "orden" INTEGER,
    "visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MenuItemCfg_pkey" PRIMARY KEY ("href")
);

