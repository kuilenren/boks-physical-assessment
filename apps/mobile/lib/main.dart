import 'package:flutter/material.dart';

import 'api_client.dart';
import 'models.dart';
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
      home: AuthGate(client: apiClient),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({required this.client, super.key});

  final BoksApiClient client;

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  late Future<Family> _family;

  @override
  void initState() {
    super.initState();
    _family = widget.client.getFamily();
  }

  void _reload() {
    setState(() => _family = widget.client.getFamily());
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Family>(
      future: _family,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (snapshot.hasError) {
          return LoginScreen(client: widget.client, onLoggedIn: _reload);
        }
        return HomeScreen(client: widget.client);
      },
    );
  }
}
