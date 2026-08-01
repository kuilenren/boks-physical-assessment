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

  Future<dynamic> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Client-Platform': 'android',
      'X-Client-Version': '0.1.0',
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
      throw ApiException(
        message ?? '服务请求失败（${response.statusCode}）。',
        code: error is Map<String, dynamic> ? error['code']?.toString() : null,
      );
    }
    return decoded['data'];
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

  Future<PostureSession> createPostureSession(String childId) async {
    final data =
        await _request(
              'POST',
              '/posture/sessions',
              body: {
                'child_id': childId,
                'consent_record_id': 'android-posture-consent-v1',
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
}
