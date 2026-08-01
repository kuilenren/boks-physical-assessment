import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'models.dart';

class ApiException implements Exception {
  const ApiException(this.message, {this.code});

  final String message;
  final String? code;

  @override
  String toString() => message;
}

class BoksApiClient {
  BoksApiClient({http.Client? client, String? baseUrl})
    : _client = client ?? http.Client(),
      baseUrl =
          (baseUrl ??
                  const String.fromEnvironment(
                    'BOKS_API_BASE_URL',
                    defaultValue: kDebugMode
                        ? 'http://10.0.2.2:3000/v1'
                        : 'https://api.example.invalid/v1',
                  ))
              .replaceFirst(RegExp(r'/$'), '');

  final http.Client _client;
  final String baseUrl;
  String? _guardianToken;
  Future<void>? _authFuture;

  Future<dynamic> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool retryAuth = true,
  }) async {
    if (path != '/auth/dev-login') {
      await _ensureAuth();
    }
    final uri = Uri.parse('$baseUrl$path');
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Client-Platform': 'android',
      'X-Client-Version': '0.1.0',
      if (_guardianToken != null) 'Authorization': 'Bearer $_guardianToken',
    };
    final response = switch (method) {
      'GET' => await _client.get(uri, headers: headers),
      'POST' => await _client.post(
        uri,
        headers: headers,
        body: jsonEncode(body),
      ),
      'PATCH' => await _client.patch(
        uri,
        headers: headers,
        body: jsonEncode(body),
      ),
      'DELETE' => await _client.delete(uri, headers: headers),
      _ => throw const ApiException('不支持的请求方式。'),
    };
    final decoded = response.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(response.body);
    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        decoded['data'] == null) {
      final error = decoded['error'];
      final message = error is Map<String, dynamic>
          ? error['message']?.toString()
          : decoded['message']?.toString();
      final exception = ApiException(
        message ?? '服务请求失败（${response.statusCode}）。',
        code: error is Map<String, dynamic> ? error['code']?.toString() : null,
      );
      if (retryAuth &&
          path != '/auth/dev-login' &&
          (exception.code == 'AUTH_REQUIRED' ||
              exception.code == 'AUTH_INVALID_TOKEN')) {
        _guardianToken = null;
        await _ensureAuth(force: true);
        return _request(method, path, body: body, retryAuth: false);
      }
      throw exception;
    }
    return decoded['data'];
  }

  Future<void> _ensureAuth({bool force = false}) async {
    if (!force && _guardianToken != null) return;
    if (_authFuture != null) return _authFuture;
    const configuredToken = String.fromEnvironment('BOKS_API_TOKEN');
    if (!force && configuredToken.isNotEmpty) {
      _guardianToken = configuredToken;
      return;
    }
    _authFuture = _login().whenComplete(() => _authFuture = null);
    return _authFuture;
  }

  Future<void> _login() async {
    final data =
        await _request(
              'POST',
              '/auth/dev-login',
              body: {'guardian_id': 'guardian-demo-001'},
              retryAuth: false,
            )
            as Map<String, dynamic>;
    final token = data['token'];
    if (token is! String || token.isEmpty) {
      throw const ApiException('监护人登录响应无效。', code: 'AUTH_FAILED');
    }
    _guardianToken = token;
  }

  Future<Family> getFamily() async {
    return Family.fromJson(
      await _request('GET', '/families/me') as Map<String, dynamic>,
    );
  }

  Future<List<Child>> listChildren() async {
    final data =
        await _request('GET', '/families/me/children') as List<dynamic>;
    return data
        .map((item) => Child.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<Child> createChild({
    required String displayName,
    required String birthDate,
    required String sexCode,
  }) async {
    final data =
        await _request(
              'POST',
              '/families/me/children',
              body: {
                'display_name': displayName,
                'birth_date': birthDate,
                'sex_code': sexCode,
                'school_stage': 'primary',
                'grade_code': 'unassigned',
              },
            )
            as Map<String, dynamic>;
    return Child.fromJson(data);
  }

  Future<Consent> recordConsent({
    required String childId,
    required String purpose,
    required String version,
  }) async {
    final data =
        await _request(
              'POST',
              '/families/me/consents',
              body: {
                'child_id': childId,
                'purpose': purpose,
                'version': version,
                'granted': true,
              },
            )
            as Map<String, dynamic>;
    return Consent.fromJson(data);
  }

  Future<List<Consent>> listConsents() async {
    final data =
        await _request('GET', '/families/me/consents') as List<dynamic>;
    return data
        .map((item) => Consent.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<Map<String, dynamic>> exportFamily() async {
    return await _request('GET', '/families/me/export') as Map<String, dynamic>;
  }

  Future<void> requestChildDeletion(String childId) async {
    await _request('POST', '/children/$childId/deletion-request');
  }

  Future<AssessmentSchema> getAssessmentSchema(String childId) async {
    final data =
        await _request(
              'GET',
              '/assessment/schemas?child_id=${Uri.encodeQueryComponent(childId)}',
            )
            as Map<String, dynamic>;
    return AssessmentSchema.fromJson(data);
  }

  Future<AssessmentSession> createAssessmentSession(
    AssessmentSchema schema,
  ) async {
    final data =
        await _request(
              'POST',
              '/assessment/sessions',
              body: {
                'child_id': schema.childId,
                'measurement_date': schema.measurementDate,
                'standard_version_id': schema.standardVersionId,
              },
            )
            as Map<String, dynamic>;
    return AssessmentSession.fromJson(data);
  }

  Future<AssessmentSession> saveAssessmentSession(
    String sessionId,
    List<AssessmentValue> values,
  ) async {
    final data =
        await _request(
              'PATCH',
              '/assessment/sessions/$sessionId',
              body: {
                'values': values.map((value) => value.toJson()).toList(),
                'test_status': 'completed',
              },
            )
            as Map<String, dynamic>;
    return AssessmentSession.fromJson(data);
  }

  Future<AssessmentReport> submitAssessmentSession(
    String sessionId,
    List<AssessmentValue> values,
  ) async {
    final data =
        await _request(
              'POST',
              '/assessment/sessions/$sessionId/submit',
              body: {
                'values': values.map((value) => value.toJson()).toList(),
                'test_status': 'completed',
              },
            )
            as Map<String, dynamic>;
    return AssessmentReport.fromJson(data);
  }

  Future<List<AssessmentReport>> listReports(String childId) async {
    final data =
        await _request(
              'GET',
              '/reports?child_id=${Uri.encodeQueryComponent(childId)}',
            )
            as List<dynamic>;
    return data
        .map((item) => AssessmentReport.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<TrendPoint>> getAssessmentTrend(String childId) async {
    final data =
        await _request(
              'GET',
              '/assessment/trends?child_id=${Uri.encodeQueryComponent(childId)}',
            )
            as Map<String, dynamic>;
    return (data['points'] as List<dynamic>)
        .map((item) => TrendPoint.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<AssessmentReport> getReport(String reportId) async {
    final data =
        await _request('GET', '/reports/$reportId') as Map<String, dynamic>;
    return AssessmentReport.fromJson(data);
  }

  Future<TrainingPlan> createTrainingPlan(
    String childId, {
    String? sourceReportId,
  }) async {
    final data =
        await _request(
              'POST',
              '/training/plans',
              body: {
                'child_id': childId,
                'source_report_id': sourceReportId,
                'goal': '提升综合体能与动作协调',
                'duration_weeks': 4,
                'days_per_week': 3,
                'minutes_per_session': 20,
                'safety_confirmed': true,
              },
            )
            as Map<String, dynamic>;
    return TrainingPlan.fromJson(data);
  }

  Future<List<TrainingPlan>> listTrainingPlans(String childId) async {
    final data =
        await _request(
              'GET',
              '/training/plans?child_id=${Uri.encodeQueryComponent(childId)}',
            )
            as List<dynamic>;
    return data
        .map((item) => TrainingPlan.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<TrainingProgress> getTrainingProgress(String planId) async {
    final data =
        await _request('GET', '/training/plans/$planId/progress')
            as Map<String, dynamic>;
    return TrainingProgress.fromJson(data);
  }

  Future<void> checkInTraining(
    String planId, {
    required int day,
    String status = 'completed',
    String? note,
  }) async {
    await _request(
      'POST',
      '/training/plans/$planId/check-ins',
      body: {'day': day, 'status': status, 'note': note},
    );
  }

  Future<TrainingPlan> pauseTraining(String planId, String reason) async {
    final data =
        await _request(
              'POST',
              '/training/plans/$planId/pause',
              body: {'reason': reason},
            )
            as Map<String, dynamic>;
    return TrainingPlan.fromJson(data['plan'] as Map<String, dynamic>);
  }

  Future<TrainingPlan> resumeTraining(String planId) async {
    final data =
        await _request(
              'POST',
              '/training/plans/$planId/resume',
              body: {'guardian_confirmed': true},
            )
            as Map<String, dynamic>;
    return TrainingPlan.fromJson(data);
  }

  Future<PostureSession> createPostureSession(String childId) async {
    final consent = await recordConsent(
      childId: childId,
      purpose: 'photo',
      version: 'posture-observation-v1',
    );
    final data =
        await _request(
              'POST',
              '/posture/sessions',
              body: {
                'child_id': childId,
                'consent_record_id': consent.id,
                'capture_protocol_version': 'posture-capture-v1',
                'required_views': ['front', 'back', 'left', 'right'],
              },
            )
            as Map<String, dynamic>;
    return PostureSession.fromJson(data);
  }

  Future<PostureSession> attachPostureView(
    String sessionId,
    String view,
    String assetId,
  ) async {
    final data =
        await _request(
              'POST',
              '/posture/sessions/$sessionId/views/$view/attach',
              body: {'asset_id': assetId},
            )
            as Map<String, dynamic>;
    return PostureSession.fromJson(data);
  }

  Future<PostureSession> submitPostureSession(String sessionId) async {
    final data =
        await _request('POST', '/posture/sessions/$sessionId/submit')
            as Map<String, dynamic>;
    return PostureSession.fromJson(data);
  }

  Future<PostureSession> getPostureSession(String sessionId) async {
    final data =
        await _request('GET', '/posture/sessions/$sessionId')
            as Map<String, dynamic>;
    return PostureSession.fromJson(data);
  }

  Future<PostureReport> getPostureReport(String reportId) async {
    final data =
        await _request('GET', '/posture/reports/$reportId')
            as Map<String, dynamic>;
    return PostureReport.fromJson(data);
  }

  Future<ChatConversation> createConversation() async {
    final data =
        await _request('POST', '/chat/conversations') as Map<String, dynamic>;
    return ChatConversation.fromJson(data);
  }

  Future<ChatConversation> getConversation(String conversationId) async {
    final data =
        await _request('GET', '/chat/conversations/$conversationId')
            as Map<String, dynamic>;
    return ChatConversation.fromJson(data);
  }

  Future<ChatMessage> sendChatMessage(
    String conversationId, {
    required String content,
    String? childId,
  }) async {
    final data =
        await _request(
              'POST',
              '/chat/conversations/$conversationId/messages',
              body: {
                'content': content,
                'child_id': childId,
                'context_report_id': null,
                'context_plan_id': null,
              },
            )
            as Map<String, dynamic>;
    return ChatMessage.fromJson(data['message'] as Map<String, dynamic>);
  }
}
