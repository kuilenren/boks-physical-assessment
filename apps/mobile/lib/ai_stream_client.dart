import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

/// AI 流式响应（OAI 兼容 SSE）
class AiStreamEvent {
  AiStreamEvent(this.event, this.data);
  final String event;
  final Map<String, dynamic> data;

  @override
  String toString() => 'AiStreamEvent($event, ${jsonEncode(data)})';
}

class AiStreamClient {
  AiStreamClient({required this.baseUrl, required this.token, http.Client? client})
      : _client = client ?? http.Client();

  final String baseUrl;
  final String token;
  final http.Client _client;

  /// 流式聊天
  /// onDelta 在每个 delta 事件触发；onDone 在 done 触发
  Stream<AiStreamEvent> chatStream({
    required String conversationId,
    required String content,
    String? childGrade,
    String? audience,
    String? traceId,
  }) async* {
    final uri = Uri.parse('$baseUrl/chat/conversations/$conversationId/stream');
    final request = http.Request('POST', uri)
      ..headers['Content-Type'] = 'application/json'
      ..headers['Accept'] = 'text/event-stream'
      ..headers['Authorization'] = 'Bearer $token'
      ..headers['X-Client-Platform'] = 'android'
      ..headers['X-Client-Version'] = '0.2.0'
      ..headers['X-Trace-Id'] = traceId ?? DateTime.now().millisecondsSinceEpoch.toString()
      ..body = jsonEncode({
        'content': content,
        'child_grade': childGrade,
        'audience': audience,
        'conversation_id': conversationId,
      });

    final response = await _client.send(request);
    if (response.statusCode != 200) {
      final body = await response.stream.bytesToString();
      throw AiStreamException(response.statusCode, body);
    }

    String event = 'message';
    final dataBuf = StringBuffer();
    final lineStream = response.stream
        .transform(utf8.decoder)
        .transform(const LineSplitter());

    await for (final line in lineStream) {
      if (line.isEmpty) {
        if (dataBuf.isNotEmpty || event.isNotEmpty) {
          try {
            final data = dataBuf.isEmpty ? <String, dynamic>{} : jsonDecode(dataBuf.toString()) as Map<String, dynamic>;
            yield AiStreamEvent(event, data);
          } catch (_) {/* ignore */}
        }
        event = 'message';
        dataBuf.clear();
        continue;
      }
      if (line.startsWith('event:')) {
        event = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        if (dataBuf.isNotEmpty) dataBuf.write('\n');
        dataBuf.write(line.substring(5).trim());
      }
    }
  }

  void close() => _client.close();
}

class AiStreamException implements Exception {
  AiStreamException(this.statusCode, this.body);
  final int statusCode;
  final String body;

  @override
  String toString() => 'AiStreamException($statusCode): $body';
}