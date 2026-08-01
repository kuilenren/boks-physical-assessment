import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { FamilyController } from "./family.controller.js";
import { AssessmentController } from "./assessment.controller.js";
import { TrainingController } from "./training.controller.js";
import { PostureController } from "./posture.controller.js";

@Module({
  controllers: [
    HealthController,
    FamilyController,
    AssessmentController,
    TrainingController,
    PostureController,
  ],
})
export class AppModule {}
