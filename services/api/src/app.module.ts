import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { FamilyController } from "./family.controller.js";
import { AssessmentController } from "./assessment.controller.js";
import { TrainingController } from "./training.controller.js";
import { PostureController } from "./posture.controller.js";
import { AuthController } from "./auth.controller.js";
import { ConfigurationController } from "./configuration.controller.js";
import { ChatController } from "./chat.controller.js";
import { KnowledgeController } from "./knowledge.controller.js";

@Module({
  controllers: [
    HealthController,
    FamilyController,
    AssessmentController,
    TrainingController,
    PostureController,
    AuthController,
    ConfigurationController,
    ChatController,
    KnowledgeController,
  ],
})
export class AppModule {}
