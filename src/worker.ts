// Load .env files before anything else — standalone Node process won't have
// Next.js's automatic env loading.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { claimNextPendingJob } from "./lib/db/jobs";
import { processJob } from "./lib/pipeline/processJob";

let isShuttingDown = false;

async function runWorker() {
    console.log("Worker started...");

    process.on('SIGINT', () => {
        console.log("SIGINT received. Shutting down...");
        isShuttingDown = true;
    });

    process.on('SIGTERM', () => {
        console.log("SIGTERM received. Shutting down...");
        isShuttingDown = true;
    });

    while (!isShuttingDown) {
        try {
            const job = await claimNextPendingJob();
            if (job) {
                console.log(`[Worker] Claimed job ${job.jobId} for video ${job.youtubeId}`);
                await processJob(job);
                console.log(`[Worker] Finished job ${job.jobId}`);
            } else {
                // sleep
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.error(`[Worker] Error claiming/processing job:`, error);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    console.log("Worker shutdown complete.");
}

runWorker().catch(console.error);
