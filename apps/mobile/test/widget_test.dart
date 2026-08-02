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

    expect(find.text('添加孩子档案'), findsOneWidget);
    expect(find.text('国家标准体测'), findsOneWidget);
    expect(find.text('四视角体态'), findsOneWidget);
    expect(find.text('还没有体测记录'), findsOneWidget);
  });
}
