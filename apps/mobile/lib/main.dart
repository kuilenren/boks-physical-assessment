import 'package:flutter/material.dart';

import 'api_client.dart';
import 'screens.dart';
import 'theme.dart';

void main() {
  runApp(const BoksApp());
}

class BoksApp extends StatelessWidget {
  const BoksApp({super.key, this.client});

  final BoksApiClient? client;

  @override
  Widget build(BuildContext context) {
    final apiClient = client ?? BoksApiClient();
    return MaterialApp(
      title: 'BOKS',
      debugShowCheckedModeBanner: false,
      theme: buildBoksTheme(),
      home: HomeScreen(client: apiClient),
    );
  }
}
