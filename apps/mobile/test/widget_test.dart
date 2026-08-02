import 'package:flutter_test/flutter_test.dart';

import 'package:boks_mobile/api_client.dart';
import 'package:boks_mobile/main.dart';
import 'package:boks_mobile/models.dart';

class FakeBoksApiClient extends BoksApiClient {
  FakeBoksApiClient() : super(baseUrl: 'http://fake.local/v1');

  @override
  Future<Family> getFamily() async {
    return const Family(id: 'family-1', displayName: '测试家庭', children: []);
  }

  @override
  Future<String?> resolveSelectedChildId(
    List<Child> children, {
    String? preferredChildId,
  }) async {
    return preferredChildId ?? (children.isEmpty ? null : children.first.id);
  }
}

void main() {
  testWidgets('BOKS home renders family entry points', (tester) async {
    await tester.pumpWidget(BoksApp(client: FakeBoksApiClient()));
    await tester.pumpAndSettle();

    expect(find.text('你好，BOKS 家庭'), findsOneWidget);
    expect(find.text('开始体测'), findsOneWidget);
    expect(find.text('体态观察'), findsOneWidget);
  });
}
