import { internal } from "./_generated/api";
import { cronJobs } from "convex/server";

const crons = cronJobs();

crons.interval(
  "clear expired locks",
  { seconds: 10 },
  internal.general.releaseExpiredLocks
);

export default crons;
