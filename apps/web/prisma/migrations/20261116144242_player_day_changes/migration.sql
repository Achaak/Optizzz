-- PlayerDay keeps a row only when a player's scores change (docs/features/site-public.md, « Relevés de nuit ») :
-- 93 % of the rows repeated the night before. The nights themselves, with their count of players and total TDC, go to
-- ServerDay. Nothing is lost: a night's scores are the row whose [day, until) holds it.

-- CreateTable
CREATE TABLE "ServerDay" (
    "server" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "players" INTEGER NOT NULL,
    "field" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ServerDay_pkey" PRIMARY KEY ("server","day")
);

INSERT INTO "ServerDay" ("server", "day", "players", "field")
SELECT "server", "day", count(*), sum("field") FROM "PlayerDay" GROUP BY "server", "day";

-- DropIndex
DROP INDEX "PlayerDay_server_day_idx";

-- AlterTable
ALTER TABLE "PlayerDay" ADD COLUMN     "until" DATE;

-- Runs of a player's rows on consecutive nights with the same scores: the first row of each run stays, its `until` the
-- night after the run (null when the run reaches the latest night).
CREATE TEMP TABLE "night_index" AS
SELECT "server", "day", row_number() OVER (PARTITION BY "server" ORDER BY "day") AS "n" FROM "ServerDay";

CREATE TEMP TABLE "kept" AS
WITH "indexed" AS (
  SELECT d.*, i."n",
    lag(i."n") OVER w AS "previousN",
    lag(ROW(d."alliance", d."field", d."buildingScore", d."technologyScore", d."trophyScore")) OVER w
      IS NOT DISTINCT FROM ROW(d."alliance", d."field", d."buildingScore", d."technologyScore", d."trophyScore")
      AS "sameScores"
  FROM "PlayerDay" d JOIN "night_index" i USING ("server", "day")
  WINDOW w AS (PARTITION BY d."server", d."playerId" ORDER BY d."day")
), "runs" AS (
  SELECT *,
    sum(CASE WHEN "previousN" = "n" - 1 AND "sameScores" THEN 0 ELSE 1 END)
      OVER (PARTITION BY "server", "playerId" ORDER BY "day") AS "run"
  FROM "indexed"
)
SELECT r."server", r."playerId", min(r."day") AS "day", max(r."n") AS "lastN",
  (array_agg(r."alliance" ORDER BY r."day"))[1] AS "alliance",
  (array_agg(r."field" ORDER BY r."day"))[1] AS "field",
  (array_agg(r."buildingScore" ORDER BY r."day"))[1] AS "buildingScore",
  (array_agg(r."technologyScore" ORDER BY r."day"))[1] AS "technologyScore",
  (array_agg(r."trophyScore" ORDER BY r."day"))[1] AS "trophyScore"
FROM "runs" r
GROUP BY r."server", r."playerId", r."run";

TRUNCATE "PlayerDay";

INSERT INTO "PlayerDay" ("server", "playerId", "day", "until", "alliance", "field", "buildingScore",
  "technologyScore", "trophyScore")
SELECT k."server", k."playerId", k."day", next."day", k."alliance", k."field", k."buildingScore",
  k."technologyScore", k."trophyScore"
FROM "kept" k
LEFT JOIN "night_index" next ON next."server" = k."server" AND next."n" = k."lastN" + 1;

DROP TABLE "kept";
DROP TABLE "night_index";

-- CreateIndex
CREATE INDEX "PlayerDay_server_until_idx" ON "PlayerDay"("server", "until");
