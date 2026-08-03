class Child {
  const Child({
    required this.id,
    required this.displayName,
    required this.birthDate,
    required this.sexCode,
    required this.schoolStage,
    required this.gradeCode,
    required this.profileStatus,
  });

  final String id;
  final String displayName;
  final String birthDate;
  final String sexCode;
  final String schoolStage;
  final String gradeCode;
  final String profileStatus;

  factory Child.fromJson(Map<String, dynamic> json) {
    return Child(
      id: json['id'] as String,
      displayName: json['display_name'] as String,
      birthDate: json['birth_date'] as String,
      sexCode: json['sex_code'] as String,
      schoolStage: json['school_stage'] as String,
      gradeCode: json['grade_code'] as String,
      profileStatus: json['profile_status'] as String,
    );
  }
}

class Family {
  const Family({
    required this.id,
    required this.displayName,
    required this.children,
  });

  final String id;
  final String displayName;
  final List<Child> children;

  factory Family.fromJson(Map<String, dynamic> json) {
    return Family(
      id: json['id'] as String,
      displayName: json['display_name'] as String,
      children: (json['children'] as List<dynamic>?)
              ?.map((item) => Child.fromJson(item as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class Consent {
  const Consent({
    required this.id,
    required this.childId,
    required this.purpose,
    required this.version,
    required this.granted,
    required this.withdrawnAt,
  });

  final String id;
  final String childId;
  final String purpose;
  final String version;
  final bool granted;
  final String? withdrawnAt;

  factory Consent.fromJson(Map<String, dynamic> json) {
    return Consent(
      id: json['id'] as String,
      childId: json['child_id'] as String,
      purpose: json['purpose'] as String,
      version: json['version'] as String,
      granted: json['granted'] as bool,
      withdrawnAt: json['withdrawn_at'] as String?,
    );
  }
}

class AssessmentIndicator {
  const AssessmentIndicator({
    required this.code,
    required this.label,
    required this.unit,
    required this.inputType,
    required this.minValue,
    required this.maxValue,
    required this.helpText,
  });

  final String code;
  final String label;
  final String unit;
  final String inputType;
  final double minValue;
  final double maxValue;
  final String helpText;

  factory AssessmentIndicator.fromJson(Map<String, dynamic> json) {
    return AssessmentIndicator(
      code: json['indicator_code'] as String,
      label: json['label'] as String,
      unit: json['unit'] as String,
      inputType: json['input_type'] as String,
      minValue: (json['min_value'] as num).toDouble(),
      maxValue: (json['max_value'] as num).toDouble(),
      helpText: json['help_text'] as String,
    );
  }
}

class AssessmentSchema {
  const AssessmentSchema({
    required this.standardVersionId,
    required this.standardName,
    required this.standardStatus,
    required this.measurementDate,
    required this.childId,
    required this.mode,
    required this.indicators,
  });

  final String standardVersionId;
  final String standardName;
  final String standardStatus;
  final String measurementDate;
  final String childId;
  final String mode;
  final List<AssessmentIndicator> indicators;

  factory AssessmentSchema.fromJson(Map<String, dynamic> json) {
    return AssessmentSchema(
      standardVersionId: json['standard_version_id'] as String,
      standardName: json['standard_name'] as String,
      standardStatus: json['standard_status'] as String,
      measurementDate: json['measurement_date'] as String,
      childId: json['child_id'] as String,
      mode: json['mode'] as String,
      indicators: (json['indicators'] as List<dynamic>?)
              ?.map(
                (item) =>
                    AssessmentIndicator.fromJson(item as Map<String, dynamic>),
              )
              .toList() ??
          [],
    );
  }
}

class AssessmentValue {
  const AssessmentValue({
    required this.indicatorCode,
    required this.rawValue,
    required this.unit,
  });

  final String indicatorCode;
  final String rawValue;
  final String unit;

  Map<String, dynamic> toJson() {
    return {
      'indicator_code': indicatorCode,
      'raw_value': rawValue,
      'unit': unit,
    };
  }
}

class AssessmentSession {
  const AssessmentSession({
    required this.id,
    required this.childId,
    required this.measurementDate,
    required this.status,
    required this.reportId,
  });

  final String id;
  final String childId;
  final String measurementDate;
  final String status;
  final String? reportId;

  factory AssessmentSession.fromJson(Map<String, dynamic> json) {
    return AssessmentSession(
      id: json['id'] as String,
      childId: json['child_id'] as String,
      measurementDate: json['measurement_date'] as String,
      status: json['status'] as String,
      reportId: json['report_id'] as String?,
    );
  }
}

class ScoreResult {
  const ScoreResult({
    required this.code,
    required this.label,
    required this.rawValue,
    required this.unit,
    required this.score,
    required this.status,
    required this.interpretation,
  });

  final String code;
  final String label;
  final String rawValue;
  final String unit;
  final double? score;
  final String status;
  final String interpretation;

  factory ScoreResult.fromJson(Map<String, dynamic> json) {
    return ScoreResult(
      code: json['indicator_code'] as String,
      label: json['label'] as String,
      rawValue: json['raw_value'] as String,
      unit: json['unit'] as String,
      score: (json['score'] as num?)?.toDouble(),
      status: json['status'] as String,
      interpretation: json['interpretation'] as String,
    );
  }
}

class AssessmentReport {
  const AssessmentReport({
    required this.id,
    required this.childId,
    required this.measurementDate,
    required this.mode,
    required this.totalScore,
    required this.level,
    required this.results,
    required this.priorityActions,
    required this.standardVersionId,
    required this.standardName,
    required this.standardStatus,
    required this.algorithmVersion,
    required this.knowledgeSnapshotId,
    required this.limitations,
    required this.generatedAt,
    this.childName,
  });

  final String id;
  final String childId;
  final String measurementDate;
  final String mode;
  final double? totalScore;
  final String level;
  final List<ScoreResult> results;
  final List<String> priorityActions;
  final String standardVersionId;
  final String standardName;
  final String standardStatus;
  final String algorithmVersion;
  final String knowledgeSnapshotId;
  final List<String> limitations;
  final String generatedAt;
  final String? childName;

  AssessmentReport withChildName(String name) {
    return AssessmentReport(
      id: id,
      childId: childId,
      measurementDate: measurementDate,
      mode: mode,
      totalScore: totalScore,
      level: level,
      results: results,
      priorityActions: priorityActions,
      standardVersionId: standardVersionId,
      standardName: standardName,
      standardStatus: standardStatus,
      algorithmVersion: algorithmVersion,
      knowledgeSnapshotId: knowledgeSnapshotId,
      limitations: limitations,
      generatedAt: generatedAt,
      childName: name,
    );
  }

  factory AssessmentReport.fromJson(Map<String, dynamic> json) {
    return AssessmentReport(
      id: json['id'] as String,
      childId: json['child_id'] as String,
      measurementDate: json['measurement_date'] as String,
      mode: json['mode'] as String,
      totalScore: (json['total_score'] as num?)?.toDouble(),
      level: json['level'] as String,
      results: (json['results'] as List<dynamic>?)
              ?.map((item) => ScoreResult.fromJson(item as Map<String, dynamic>))
              .toList() ??
          [],
      priorityActions: (json['priority_actions'] as List<dynamic>?)?.cast<String>() ?? [],
      standardVersionId: json['standard_version_id'] as String,
      standardName: json['standard_name'] as String,
      standardStatus: json['standard_status'] as String,
      algorithmVersion: json['algorithm_version'] as String,
      knowledgeSnapshotId: json['knowledge_snapshot_id'] as String,
      limitations: (json['limitations'] as List<dynamic>?)?.cast<String>() ?? [],
      generatedAt: json['generated_at'] as String,
    );
  }
}

class TrendPoint {
  const TrendPoint({
    required this.reportId,
    required this.measurementDate,
    required this.totalScore,
  });

  final String reportId;
  final String measurementDate;
  final double? totalScore;

  factory TrendPoint.fromJson(Map<String, dynamic> json) {
    return TrendPoint(
      reportId: json['report_id'] as String,
      measurementDate: json['measurement_date'] as String,
      totalScore: (json['total_score'] as num?)?.toDouble(),
    );
  }
}

class TrainingItem {
  const TrainingItem({
    required this.week,
    required this.day,
    required this.phase,
    required this.exerciseName,
    required this.durationMinutes,
    required this.safetyNote,
    required this.stopCondition,
  });

  final int week;
  final int day;
  final String phase;
  final String exerciseName;
  final double durationMinutes;
  final String safetyNote;
  final String stopCondition;

  factory TrainingItem.fromJson(Map<String, dynamic> json) {
    return TrainingItem(
      week: json['week'] as int,
      day: json['day'] as int,
      phase: json['phase'] as String,
      exerciseName: json['exercise_name'] as String,
      durationMinutes: (json['duration_minutes'] as num).toDouble(),
      safetyNote: json['safety_note'] as String,
      stopCondition: json['stop_condition'] as String,
    );
  }
}

class TrainingPlan {
  const TrainingPlan({
    required this.id,
    required this.childId,
    required this.sourceReportId,
    required this.goal,
    required this.durationWeeks,
    required this.daysPerWeek,
    required this.minutesPerSession,
    required this.status,
    required this.items,
  });

  final String id;
  final String childId;
  final String? sourceReportId;
  final String goal;
  final int durationWeeks;
  final int daysPerWeek;
  final int minutesPerSession;
  final String status;
  final List<TrainingItem> items;

  factory TrainingPlan.fromJson(Map<String, dynamic> json) {
    return TrainingPlan(
      id: json['id'] as String,
      childId: json['child_id'] as String,
      sourceReportId: json['source_report_id'] as String?,
      goal: json['goal'] as String,
      durationWeeks: json['duration_weeks'] as int,
      daysPerWeek: json['days_per_week'] as int,
      minutesPerSession: json['minutes_per_session'] as int,
      status: json['status'] as String,
      items: (json['items'] as List<dynamic>?)
              ?.map(
                (item) => TrainingItem.fromJson(item as Map<String, dynamic>),
              )
              .toList() ??
          [],
    );
  }
}

class TrainingProgress {
  const TrainingProgress({
    required this.planId,
    required this.completed,
    required this.skipped,
    required this.totalDays,
    required this.status,
  });

  final String planId;
  final int completed;
  final int skipped;
  final int totalDays;
  final String status;

  factory TrainingProgress.fromJson(Map<String, dynamic> json) {
    return TrainingProgress(
      planId: json['plan_id'] as String,
      completed: json['completed'] as int,
      skipped: json['skipped'] as int,
      totalDays: json['total_days'] as int,
      status: json['status'] as String,
    );
  }
}

class PostureSession {
  const PostureSession({
    required this.id,
    required this.childId,
    required this.status,
    required this.requiredViews,
    required this.attachedViews,
    required this.qualityOverall,
    required this.analysis,
    required this.limitations,
  });

  final String id;
  final String childId;
  final String status;
  final List<String> requiredViews;
  final List<String> attachedViews;
  final String qualityOverall;
  final PostureAnalysis? analysis;
  final List<String> limitations;

  factory PostureSession.fromJson(Map<String, dynamic> json) {
    final quality = json['quality'] as Map<String, dynamic>?;
    return PostureSession(
      id: json['id'] as String,
      childId: json['child_id'] as String,
      status: json['status'] as String,
      requiredViews: (json['required_views'] as List<dynamic>?)?.cast<String>() ?? [],
      attachedViews: (json['attached_views'] as List<dynamic>?)?.cast<String>() ?? [],
      qualityOverall: (quality?['overall'] as String?) ?? 'pending',
      analysis: json['analysis'] is Map<String, dynamic>
          ? PostureAnalysis.fromJson(json['analysis'] as Map<String, dynamic>)
          : null,
      limitations: (json['limitations'] as List<dynamic>?)?.cast<String>() ?? [],
    );
  }
}

class PostureAnalysis {
  const PostureAnalysis({
    required this.reportId,
    required this.riskLevel,
    required this.observationStatus,
    required this.confidence,
  });

  final String reportId;
  final String riskLevel;
  final String observationStatus;
  final String confidence;

  factory PostureAnalysis.fromJson(Map<String, dynamic> json) {
    return PostureAnalysis(
      reportId: json['report_id'] as String,
      riskLevel: json['risk_level'] as String,
      observationStatus: json['observation_status'] as String,
      confidence: json['confidence'] as String,
    );
  }
}

class PostureReport {
  const PostureReport({
    required this.id,
    required this.childId,
    required this.sessionId,
    required this.riskLevel,
    required this.observationStatus,
    required this.confidence,
    required this.observations,
    required this.recommendations,
    required this.limitations,
    required this.generatedAt,
  });

  final String id;
  final String childId;
  final String sessionId;
  final String riskLevel;
  final String observationStatus;
  final String confidence;
  final List<String> observations;
  final List<String> recommendations;
  final List<String> limitations;
  final String generatedAt;

  factory PostureReport.fromJson(Map<String, dynamic> json) {
    return PostureReport(
      id: json['id'] as String,
      childId: json['child_id'] as String,
      sessionId: json['session_id'] as String,
      riskLevel: json['risk_level'] as String,
      observationStatus: json['observation_status'] as String,
      confidence: json['confidence'] as String,
      observations: (json['observations'] as List<dynamic>?)?.cast<String>() ?? [],
      recommendations: (json['recommendations'] as List<dynamic>?)?.cast<String>() ?? [],
      limitations: (json['limitations'] as List<dynamic>?)?.cast<String>() ?? [],
      generatedAt: json['generated_at'] as String,
    );
  }
}

class ChatCitation {
  const ChatCitation({
    required this.sourceId,
    required this.title,
    required this.version,
  });

  final String sourceId;
  final String title;
  final String version;

  factory ChatCitation.fromJson(Map<String, dynamic> json) {
    return ChatCitation(
      sourceId: json['source_id'] as String,
      title: json['title'] as String,
      version: json['version'] as String,
    );
  }
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.citations,
    required this.createdAt,
  });

  final String id;
  final String role;
  final String content;
  final List<ChatCitation> citations;
  final String createdAt;

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] as String,
      role: json['role'] as String,
      content: json['content'] as String,
      citations: (json['citations'] as List<dynamic>?)
              ?.map((item) => ChatCitation.fromJson(item as Map<String, dynamic>))
              .toList() ??
          [],
      createdAt: json['created_at'] as String,
    );
  }
}

class ChatConversation {
  const ChatConversation({required this.id, required this.messages});

  final String id;
  final List<ChatMessage> messages;

  factory ChatConversation.fromJson(Map<String, dynamic> json) {
    return ChatConversation(
      id: json['id'] as String,
      messages: (json['messages'] as List<dynamic>?)
              ?.map((item) => ChatMessage.fromJson(item as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
