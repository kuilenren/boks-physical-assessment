import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter/services.dart';

import 'api_client.dart';
import 'models.dart';
import 'theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    required this.client,
    required this.onLoggedIn,
    super.key,
  });

  final BoksApiClient client;
  final VoidCallback onLoggedIn;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  var _sendingCode = false;
  var _loggingIn = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _requestCode() async {
    final phone = _phoneController.text.trim();
    if (phone.isEmpty) {
      _showMessage('请输入手机号。');
      return;
    }
    setState(() => _sendingCode = true);
    try {
      await widget.client.requestPhoneCode(phone);
      _showMessage('验证码已发送，请注意查收。');
    } on ApiException catch (error) {
      _showMessage(error.message);
    } finally {
      if (mounted) setState(() => _sendingCode = false);
    }
  }

  Future<void> _login() async {
    final phone = _phoneController.text.trim();
    final code = _codeController.text.trim();
    if (phone.isEmpty || code.isEmpty) {
      _showMessage('请输入手机号和验证码。');
      return;
    }
    setState(() => _loggingIn = true);
    try {
      await widget.client.loginWithPhone(phone, code);
      if (mounted) widget.onLoggedIn();
    } on ApiException catch (error) {
      _showMessage(error.message);
    } finally {
      if (mounted) setState(() => _loggingIn = false);
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
            children: [
              Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [boksForestDark, boksForest, boksBrand],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x33103E2F),
                      blurRadius: 24,
                      offset: Offset(0, 12),
                    ),
                  ],
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor: Color(0x33FFFFFF),
                      child: Icon(Icons.spa_outlined, color: Colors.white),
                    ),
                    SizedBox(height: 18),
                    Text(
                      'BOKS 家长登录',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.4,
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      '登录后管理孩子的体测记录、训练计划和体态观察。',
                      style: TextStyle(color: Color(0xE6FFFFFF), height: 1.5),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: '手机号',
                  prefixIcon: Icon(Icons.phone_iphone_outlined),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _codeController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: '验证码',
                        prefixIcon: Icon(Icons.pin_outlined),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  TextButton(
                    onPressed: _sendingCode ? null : _requestCode,
                    child: _sendingCode
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('获取验证码'),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loggingIn ? null : _login,
                child: _loggingIn
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('登录'),
              ),
              const SizedBox(height: 14),
              const Text(
                '手机号仅用于身份验证。若账号尚未绑定 BOKS 家庭，请联系 BOKS 工作人员。',
                style: TextStyle(color: boksMuted, fontSize: 12, height: 1.5),
              ),
            ],
          ),
        ),
      );
    }
  }

class HomeScreen extends StatefulWidget {
  const HomeScreen({required this.client, required this.onLoggedOut, super.key});

  final BoksApiClient client;
  final VoidCallback onLoggedOut;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeData {
  const _HomeData({
    required this.family,
    required this.report,
    required this.plan,
    required this.progress,
    required this.insightError,
  });

  final Family family;
  final AssessmentReport? report;
  final TrainingPlan? plan;
  final TrainingProgress? progress;
  final String? insightError;
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<_HomeData> _homeData;
  String? _selectedChildId;

  @override
  void initState() {
    super.initState();
    _homeData = _loadHomeData();
  }

  void _reload() {
    setState(() => _homeData = _loadHomeData());
  }

  Future<_HomeData> _loadHomeData() async {
    final family = await widget.client.getFamily();
    final selected = await widget.client.resolveSelectedChildId(
      family.children,
    );
    if (mounted) _selectedChildId = selected;

    AssessmentReport? report;
    TrainingPlan? plan;
    TrainingProgress? progress;
    String? insightError;
    if (selected != null) {
      try {
        final reports = await widget.client.listReports(selected);
        reports.sort(
          (left, right) =>
              right.measurementDate.compareTo(left.measurementDate),
        );
        report = reports.isEmpty ? null : reports.first;
        final plans = await widget.client.listTrainingPlans(selected);
        plan = plans.isEmpty ? null : plans.first;
        if (plan != null) {
          progress = await widget.client.getTrainingProgress(plan.id);
        }
      } catch (error) {
        insightError = error.toString();
      }
    }

    return _HomeData(
      family: family,
      report: report,
      plan: plan,
      progress: progress,
      insightError: insightError,
    );
  }

  void _open(Widget page) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));
  }

  String _reportLevelLabel(String level) {
    return const {
          'excellent': '优秀',
          'good': '良好',
          'pass': '及格',
          'fail': '待提升',
          'reference_only': '参考进步',
        }[level] ??
        '待查看';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: const Row(
          children: [
            CircleAvatar(
              radius: 17,
              backgroundColor: boksBrandLight,
              child: Text(
                'B',
                style: TextStyle(
                  color: boksForest,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            SizedBox(width: 10),
            Text('BOKS智能体测体态分析'),
          ],
        ),
        actions: [
          IconButton(
            tooltip: '隐私与数据说明',
            onPressed: () => _open(const PrivacyScreen()),
            icon: const Icon(Icons.shield_outlined),
          ),
          const SizedBox(width: 4),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 0,
        onDestinationSelected: (index) {
          switch (index) {
            case 1:
              _open(AssessmentStartScreen(client: widget.client));
            case 2:
              _open(TrainingScreen(client: widget.client));
            case 3:
              _open(
                FamilyScreen(
                  client: widget.client,
                  onLoggedOut: widget.onLoggedOut,
                ),
              );
          }
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: '首页',
          ),
          NavigationDestination(
            icon: Icon(Icons.assessment_outlined),
            selectedIcon: Icon(Icons.assessment),
            label: '体测',
          ),
          NavigationDestination(
            icon: Icon(Icons.directions_run_outlined),
            selectedIcon: Icon(Icons.directions_run),
            label: '训练',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: '我的',
          ),
        ],
      ),
      body: FutureBuilder<_HomeData>(
        future: _homeData,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorPanel(
              message: snapshot.error.toString(),
              onRetry: _reload,
            );
          }
          final data = snapshot.data!;
          final family = data.family;
          final child = family.children.isEmpty
              ? null
              : family.children.firstWhere(
                  (item) => item.id == _selectedChildId,
                  orElse: () => family.children.first,
                );
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
              children: [
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [boksForest, boksBrand],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x26103E2F),
                        blurRadius: 18,
                        offset: Offset(0, 9),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'BOKS 家庭成长记录',
                              style: TextStyle(
                                color: Color(0xB3FFFFFF),
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          StatusPill(
                            label: family.children.isEmpty ? '先建立档案' : '监护人已就绪',
                            backgroundColor: Colors.white.withValues(
                              alpha: 0.14,
                            ),
                            foregroundColor: Colors.white,
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      Text(
                        child?.displayName ?? '添加孩子档案',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 30,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        child == null
                            ? '建立档案后开始记录成长变化'
                            : '${child.schoolStage} · 仅供 BOKS 家庭使用',
                        style: const TextStyle(
                          color: Color(0xD9FFFFFF),
                          fontSize: 14,
                        ),
                      ),
                      if (family.children.isNotEmpty) ...[
                        const SizedBox(height: 18),
                        DropdownButtonFormField<String>(
                          initialValue: child?.id,
                          style: const TextStyle(
                            color: boksInk,
                            fontWeight: FontWeight.w700,
                          ),
                          dropdownColor: Colors.white,
                          iconEnabledColor: Colors.white,
                          decoration: InputDecoration(
                            labelText: '当前孩子',
                            labelStyle: const TextStyle(color: Colors.white),
                            filled: true,
                            fillColor: Colors.white.withValues(alpha: 0.14),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(
                                color: Color(0x66FFFFFF),
                              ),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: Colors.white),
                            ),
                          ),
                          items: family.children
                              .map(
                                (item) => DropdownMenuItem(
                                  value: item.id,
                                  child: Text(item.displayName),
                                ),
                              )
                              .toList(),
                          onChanged: (value) {
                            if (value == null) return;
                            setState(() => _selectedChildId = value);
                            unawaited(widget.client.setSelectedChildId(value));
                            _reload();
                          },
                        ),
                      ],
                    ],
                  ),
                ),
                if (data.insightError != null) ...[
                  const SizedBox(height: 12),
                  DangerCard(message: '${data.insightError} 报告和训练摘要暂时不可用。'),
                ],
                const SizedBox(height: 24),
                _HomeSectionHeading(
                  title: '最近一次体测',
                  actionLabel: '全部记录',
                  onAction: () =>
                      _open(ReportListScreen(client: widget.client)),
                ),
                const SizedBox(height: 10),
                _HomeReportCard(
                  report: data.report,
                  levelLabel: data.report == null
                      ? null
                      : _reportLevelLabel(data.report!.level),
                  onOpen: data.report == null
                      ? () =>
                            _open(AssessmentStartScreen(client: widget.client))
                      : () => _open(
                          ReportDetailScreen(
                            client: widget.client,
                            report: data.report!,
                          ),
                        ),
                ),
                const SizedBox(height: 8),
                _HomeSectionHeading(title: '下一步怎么做', actionLabel: '两项核心记录'),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: ActionTile(
                        icon: Icons.assessment_outlined,
                        title: '国家标准体测',
                        subtitle: '按现场数据逐项录入',
                        onTap: () =>
                            _open(AssessmentStartScreen(client: widget.client)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ActionTile(
                        icon: Icons.accessibility_new,
                        title: '四视角体态',
                        subtitle: '授权后完成拍摄',
                        accentColor: boksSkyLight,
                        onTap: () =>
                            _open(PostureConsentScreen(client: widget.client)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                _HomeSectionHeading(
                  title: '家庭训练计划',
                  actionLabel: data.plan == null ? null : '打开计划',
                  onAction: data.plan == null
                      ? null
                      : () => _open(TrainingScreen(client: widget.client)),
                ),
                const SizedBox(height: 10),
                _HomeTrainingCard(
                  plan: data.plan,
                  progress: data.progress,
                  onOpen: () => _open(TrainingScreen(client: widget.client)),
                ),
                const SizedBox(height: 8),
                Card(
                  color: boksAmberLight,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.info_outline,
                          color: Color(0xFF8B6508),
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text(
                            'BOKS 提供体测评分与非诊断性体态观察。若孩子出现明显疼痛、麻木、无力或急症，请停止训练并及时就医。',
                            style: TextStyle(
                              color: Color(0xFF6F5516),
                              height: 1.45,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Card(
                  child: Column(
                    children: [
                      ActionButton(
                        label: '专业咨询',
                        icon: Icons.chat_bubble_outline,
                        onPressed: () =>
                            _open(ChatScreen(client: widget.client)),
                      ),
                      ActionButton(
                        label: '儿童档案与数据控制',
                        icon: Icons.manage_accounts_outlined,
                        onPressed: () => _open(
                          FamilyScreen(
                            client: widget.client,
                            onLoggedOut: widget.onLoggedOut,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class FamilyScreen extends StatefulWidget {
  const FamilyScreen({required this.client, required this.onLoggedOut, super.key});

  final BoksApiClient client;
  final VoidCallback onLoggedOut;

  @override
  State<FamilyScreen> createState() => _FamilyScreenState();
}

class _FamilyScreenState extends State<FamilyScreen> {
  late Future<List<Child>> _children;

  @override
  void initState() {
    super.initState();
    _children = widget.client.listChildren();
  }

  void _reload() {
    setState(() => _children = widget.client.listChildren());
  }

  void _open(Widget page) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));
  }

  Future<void> _addChild() async {
    final nameController = TextEditingController();
    final birthController = TextEditingController(text: '2018-01-01');
    var sexCode = 'unspecified';
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('添加儿童'),
        content: StatefulBuilder(
          builder: (context, setDialogState) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: '称呼'),
              ),
              TextField(
                controller: birthController,
                decoration: const InputDecoration(
                  labelText: '出生日期（YYYY-MM-DD）',
                ),
              ),
              DropdownButtonFormField<String>(
                initialValue: sexCode,
                decoration: const InputDecoration(labelText: '性别（可选）'),
                items: const [
                  DropdownMenuItem(value: 'unspecified', child: Text('未选择')),
                  DropdownMenuItem(value: 'female', child: Text('女')),
                  DropdownMenuItem(value: 'male', child: Text('男')),
                ],
                onChanged: (value) =>
                    setDialogState(() => sexCode = value ?? 'unspecified'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () async {
              if (nameController.text.trim().isEmpty) return;
              try {
                await widget.client.createChild(
                  displayName: nameController.text.trim(),
                  birthDate: birthController.text.trim(),
                  sexCode: sexCode,
                );
                if (context.mounted) Navigator.pop(context, true);
              } on ApiException catch (error) {
                if (context.mounted) {
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(SnackBar(content: Text(error.message)));
                }
              }
            },
            child: const Text('保存'),
          ),
        ],
      ),
    );
    nameController.dispose();
    birthController.dispose();
    if (result == true) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('儿童档案')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addChild,
        icon: const Icon(Icons.add),
        label: const Text('添加'),
      ),
      body: FutureBuilder<List<Child>>(
        future: _children,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorPanel(
              message: snapshot.error.toString(),
              onRetry: _reload,
            );
          }
          final children = snapshot.data!;
          if (children.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('还没有儿童档案。'),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: _addChild,
                    icon: const Icon(Icons.add),
                    label: const Text('添加'),
                  ),
                ],
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ...children.map(
                (child) => Card(
                  child: ListTile(
                    leading: const CircleAvatar(
                      backgroundColor: boksBrandLight,
                      child: Icon(Icons.person, color: boksBrand),
                    ),
                    title: Text(child.displayName),
                    subtitle: Text(
                      '${child.birthDate} · ${child.schoolStage} · ${child.gradeCode}',
                    ),
                    trailing: StatusPill(
                      label:
                          child.profileStatus == 'active' ? '正常' : '已停用',
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              SectionCard(
                title: '监护人控制',
                child: Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.shield_outlined),
                      title: const Text('数据控制与导出'),
                      subtitle: const Text('导出家庭数据、申请删除儿童数据'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => _open(
                        DataControlScreen(client: widget.client),
                      ),
                    ),
                    ListTile(
                      leading: const Icon(Icons.logout),
                      title: const Text('退出登录'),
                      subtitle: const Text('退出后需重新验证身份'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => _confirmLogout(),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _confirmLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('退出登录'),
        content: const Text('确定要退出当前账号吗？退出后需重新验证身份。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('退出'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await widget.client.logout();
    } on ApiException {
      // 登出即使远端失败也清理本地 token，保证本地一定回到登录态。
    }
    if (mounted) widget.onLoggedOut();
  }
}

class AssessmentStartScreen extends StatefulWidget {
  const AssessmentStartScreen({required this.client, super.key});

  final BoksApiClient client;

  @override
  State<AssessmentStartScreen> createState() => _AssessmentStartScreenState();
}

class _AssessmentStartScreenState extends State<AssessmentStartScreen> {
  late Future<List<Child>> _children;
  String? _childId;

  @override
  void initState() {
    super.initState();
    _children = widget.client.listChildren().then((items) {
      return widget.client.resolveSelectedChildId(items).then((selected) {
        _childId = selected;
        return items;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('开始体测')),
      body: FutureBuilder<List<Child>>(
        future: _children,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorPanel(message: snapshot.error.toString());
          }
          final children = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const Text(
                '按现场实际完成的项目逐项录入。缺测不会静默当作 0 分。',
                style: TextStyle(color: boksMuted),
              ),
              const SizedBox(height: 16),
              if (children.isEmpty)
                const DangerCard(message: '还没有儿童档案，请先添加儿童。')
              else ...[
                DropdownButtonFormField<String>(
                  initialValue: _childId,
                  decoration: const InputDecoration(labelText: '选择孩子'),
                  items: children
                      .map(
                        (child) => DropdownMenuItem(
                          value: child.id,
                          child: Text(child.displayName),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    setState(() => _childId = value);
                    unawaited(widget.client.setSelectedChildId(value));
                  },
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () {
                    if (_childId == null) return;
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => AssessmentInputScreen(
                          client: widget.client,
                          childId: _childId!,
                        ),
                      ),
                    );
                  },
                  child: const Text('进入体测录入'),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class AssessmentInputScreen extends StatefulWidget {
  const AssessmentInputScreen({
    required this.client,
    required this.childId,
    super.key,
  });

  final BoksApiClient client;
  final String childId;

  @override
  State<AssessmentInputScreen> createState() => _AssessmentInputScreenState();
}

class _AssessmentInputScreenState extends State<AssessmentInputScreen> {
  late Future<AssessmentSchema> _schema;
  final Map<String, TextEditingController> _controllers = {};
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _schema = widget.client.getAssessmentSchema(widget.childId);
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _submit(AssessmentSchema schema) async {
    final values = schema.indicators
        .map(
          (indicator) => AssessmentValue(
            indicatorCode: indicator.code,
            rawValue: _controllers[indicator.code]?.text.trim() ?? '',
            unit: indicator.unit,
          ),
        )
        .where((value) => value.rawValue.isNotEmpty)
        .toList();
    if (values.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('至少录入一项实际测量值。')));
      return;
    }
    setState(() => _submitting = true);
    try {
      final session = await widget.client.createAssessmentSession(schema);
      await widget.client.saveAssessmentSession(session.id, values);
      final report = await widget.client.submitAssessmentSession(
        session.id,
        values,
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) =>
              ReportDetailScreen(client: widget.client, report: report),
        ),
      );
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('体测录入')),
      body: FutureBuilder<AssessmentSchema>(
        future: _schema,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorPanel(message: snapshot.error.toString());
          }
          final schema = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                schema.standardName,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 4),
              Text(
                schema.mode == 'reference_only'
                    ? '幼儿阶段为参考进步模式，不生成国家总评。'
                    : '开发版评分仅用于联调，正式上线前需替换为审核发布的标准知识库。',
                style: const TextStyle(color: boksMuted),
              ),
              const SizedBox(height: 16),
              ...schema.indicators.map((indicator) {
                final controller = _controllers.putIfAbsent(
                  indicator.code,
                  TextEditingController.new,
                );
                return Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: TextField(
                    controller: controller,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: InputDecoration(
                      labelText: indicator.label,
                      helperText: '${indicator.helpText} 单位：${indicator.unit}',
                    ),
                  ),
                );
              }),
              ElevatedButton(
                onPressed: _submitting ? null : () => _submit(schema),
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('提交并生成报告'),
              ),
            ],
          );
        },
      ),
    );
  }
}

class ReportListScreen extends StatefulWidget {
  const ReportListScreen({required this.client, super.key});

  final BoksApiClient client;

  @override
  State<ReportListScreen> createState() => _ReportListScreenState();
}

class _ReportListScreenState extends State<ReportListScreen> {
  late Future<List<AssessmentReport>> _reports;

  @override
  void initState() {
    super.initState();
    _reports = _load();
  }

  Future<List<AssessmentReport>> _load() async {
    final children = await widget.client.listChildren();
    final groups = await Future.wait<List<AssessmentReport>>(
      children.map((child) => widget.client.listReports(child.id)),
    );
    return groups.expand((items) => items).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('体测报告')),
      body: FutureBuilder<List<AssessmentReport>>(
        future: _reports,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorPanel(
              message: snapshot.error.toString(),
              onRetry: () => setState(() => _reports = _load()),
            );
          }
          final reports = snapshot.data!;
          if (reports.isEmpty) return const Center(child: Text('还没有已生成报告。'));
          return ListView(
            padding: const EdgeInsets.all(16),
            children: reports
                .map(
                  (report) => Card(
                    child: ListTile(
                      title: Text(
                        report.mode == 'reference_only' ? '参考进步报告' : '综合体测报告',
                      ),
                      subtitle: Text(
                        '${report.measurementDate} · ${report.childName ?? report.childId}',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => ReportDetailScreen(
                            client: widget.client,
                            report: report,
                          ),
                        ),
                      ),
                    ),
                  ),
                )
                .toList(),
          );
        },
      ),
    );
  }
}

class ReportDetailScreen extends StatelessWidget {
  const ReportDetailScreen({
    required this.client,
    required this.report,
    super.key,
  });

  final BoksApiClient client;
  final AssessmentReport report;

  String _levelLabel(String level) {
    return const {
          'excellent': '优秀',
          'good': '良好',
          'pass': '及格',
          'fail': '待提升',
          'reference_only': '参考进步模式',
        }[level] ??
        '—';
  }

  @override
  Widget build(BuildContext context) {
    final referenceOnly = report.mode == 'reference_only';
    return Scaffold(
      appBar: AppBar(title: const Text('报告详情')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            report.childName ?? report.childId,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          Text(
            report.measurementDate,
            style: const TextStyle(color: boksMuted),
          ),
          const SizedBox(height: 16),
          if (referenceOnly)
            const DangerCard(message: '幼儿阶段不套用小学及以上国家总评，仅用于家庭训练沟通。'),
          Card(
            color: boksBrand,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Text(
                    referenceOnly ? '参考进步分' : '综合评分',
                    style: const TextStyle(color: Colors.white),
                  ),
                  Text(
                    report.totalScore?.toStringAsFixed(1) ?? '—',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 48,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    _levelLabel(report.level),
                    style: const TextStyle(color: Colors.white),
                  ),
                ],
              ),
            ),
          ),
          SectionCard(
            title: '项目结果',
            child: Column(
              children: report.results
                  .map(
                    (result) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(result.label),
                      subtitle: Text(
                        '${result.rawValue.isEmpty ? '未录入' : result.rawValue} ${result.unit}\n${result.interpretation}',
                      ),
                      trailing: Text(
                        result.score == null
                            ? '未评分'
                            : '${result.score!.toStringAsFixed(1)} 分',
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          SectionCard(
            title: '训练建议',
            child: Column(
              children: [
                ...report.priorityActions.map(
                  (item) => Align(
                    alignment: Alignment.centerLeft,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(item),
                    ),
                  ),
                ),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => TrainingScreen(
                        client: client,
                        initialChildId: report.childId,
                        sourceReportId: report.id,
                      ),
                    ),
                  ),
                  child: const Text('查看训练计划'),
                ),
              ],
            ),
          ),
          SectionCard(
            title: '报告依据',
            child: Text(
              '标准版本：${report.standardVersionId}\n'
              '算法版本：${report.algorithmVersion}\n'
              '知识快照：${report.knowledgeSnapshotId}\n'
              '${report.limitations.join('\n')}',
              style: const TextStyle(color: boksMuted),
            ),
          ),
          FutureBuilder<List<TrendPoint>>(
            future: client.getAssessmentTrend(report.childId),
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const SectionCard(
                  title: '历史趋势',
                  child: LinearProgressIndicator(),
                );
              }
              if (snapshot.hasError || snapshot.data!.isEmpty) {
                return const SectionCard(
                  title: '历史趋势',
                  child: Text(
                    '完成更多次体测后，这里会显示变化趋势。',
                    style: TextStyle(color: boksMuted),
                  ),
                );
              }
              return SectionCard(
                title: '历史趋势',
                child: Column(
                  children: snapshot.data!
                      .map(
                        (point) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(point.measurementDate),
                          trailing: Text(
                            point.totalScore == null
                                ? '参考记录'
                                : '${point.totalScore!.toStringAsFixed(1)} 分',
                          ),
                        ),
                      )
                      .toList(),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class TrainingScreen extends StatefulWidget {
  const TrainingScreen({
    required this.client,
    this.initialChildId,
    this.sourceReportId,
    super.key,
  });

  final BoksApiClient client;
  final String? initialChildId;
  final String? sourceReportId;

  @override
  State<TrainingScreen> createState() => _TrainingScreenState();
}

class _TrainingScreenState extends State<TrainingScreen> {
  late Future<List<Child>> _children;
  List<TrainingPlan> _plans = [];
  TrainingProgress? _progress;
  String? _childId;
  bool _loadingPlan = false;
  int? _workingDay;

  @override
  void initState() {
    super.initState();
    _children = widget.client.listChildren().then((items) {
      return widget.client
          .resolveSelectedChildId(
            items,
            preferredChildId: widget.initialChildId,
          )
          .then((selected) {
            _childId = selected;
            return items;
          });
    });
    _children.then((_) => _loadPlans());
  }

  Future<void> _loadPlans() async {
    final childId = _childId;
    if (childId == null) return;
    final plans = await widget.client.listTrainingPlans(childId);
    final progress = plans.isEmpty
        ? null
        : await widget.client.getTrainingProgress(plans.first.id);
    if (mounted) {
      setState(() {
        _plans = plans;
        _progress = progress;
      });
    }
  }

  Future<void> _generate() async {
    final childId = _childId;
    if (childId == null) return;
    setState(() => _loadingPlan = true);
    try {
      final plan = await widget.client.createTrainingPlan(
        childId,
        sourceReportId: widget.sourceReportId,
      );
      final progress = await widget.client.getTrainingProgress(plan.id);
      if (mounted) {
        setState(() {
          _plans = [plan, ..._plans];
          _progress = progress;
        });
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _loadingPlan = false);
    }
  }

  Future<void> _checkIn(TrainingPlan plan, int day) async {
    setState(() => _workingDay = day);
    try {
      await widget.client.checkInTraining(plan.id, day: day);
      final progress = await widget.client.getTrainingProgress(plan.id);
      if (mounted) setState(() => _progress = progress);
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _workingDay = null);
    }
  }

  Future<void> _togglePause(TrainingPlan plan) async {
    try {
      final updated = plan.status == 'paused_safety_review'
          ? await widget.client.resumeTraining(plan.id)
          : await widget.client.pauseTraining(plan.id, '监护人主动暂停，等待安全确认。');
      final progress = await widget.client.getTrainingProgress(plan.id);
      if (mounted) {
        setState(() {
          _plans = _plans
              .map((item) => item.id == updated.id ? updated : item)
              .toList();
          _progress = progress;
        });
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('训练计划')),
      body: FutureBuilder<List<Child>>(
        future: _children,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorPanel(message: snapshot.error.toString());
          }
          final children = snapshot.data!;
          if (children.isEmpty) {
            return const Center(child: Text('请先添加儿童档案。'));
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              DropdownButtonFormField<String>(
                initialValue: _childId,
                decoration: const InputDecoration(labelText: '选择孩子'),
                items: children
                    .map(
                      (child) => DropdownMenuItem(
                        value: child.id,
                        child: Text(child.displayName),
                      ),
                    )
                    .toList(),
                onChanged: (value) async {
                  setState(() => _childId = value);
                  await widget.client.setSelectedChildId(value);
                  if (value != null) {
                    final plans = await widget.client.listTrainingPlans(value);
                    final progress = plans.isEmpty
                        ? null
                        : await widget.client.getTrainingProgress(
                            plans.first.id,
                          );
                    if (mounted) {
                      setState(() {
                        _plans = plans;
                        _progress = progress;
                      });
                    }
                  }
                },
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadingPlan ? null : _generate,
                child: _loadingPlan
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text('生成训练计划'),
              ),
              const SizedBox(height: 16),
              if (_plans.isEmpty)
                const Text('还没有训练计划。', style: TextStyle(color: boksMuted)),
              ..._plans.map(
                (plan) => _TrainingPlanCard(
                  plan: plan,
                  progress: _progress,
                  workingDay: _workingDay,
                  onCheckIn: (day) => _checkIn(plan, day),
                  onTogglePause: () => _togglePause(plan),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _TrainingPlanCard extends StatelessWidget {
  const _TrainingPlanCard({
    required this.plan,
    required this.progress,
    required this.workingDay,
    required this.onCheckIn,
    required this.onTogglePause,
  });

  final TrainingPlan plan;
  final TrainingProgress? progress;
  final int? workingDay;
  final Future<void> Function(int day) onCheckIn;
  final Future<void> Function() onTogglePause;

  @override
  Widget build(BuildContext context) {
    final firstWeek = plan.items.where((item) => item.week == 1).toList();
    final dayItems = <int, TrainingItem>{};
    for (final item in firstWeek) {
      dayItems.putIfAbsent(item.day, () => item);
    }
    return SectionCard(
      title: plan.goal,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${plan.durationWeeks} 周 · 每周 ${plan.daysPerWeek} 次 · 每次约 ${plan.minutesPerSession} 分钟',
            style: const TextStyle(color: boksMuted),
          ),
          StatusPill(
            label: plan.status == 'paused_safety_review' ? '已暂停安全复核' : '进行中',
          ),
          if (progress != null)
            Text(
              '已完成 ${progress!.completed} 次 · 跳过 ${progress!.skipped} 次 · 共 ${progress!.totalDays} 次',
              style: const TextStyle(color: boksMuted),
            ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => onTogglePause(),
              child: Text(
                plan.status == 'paused_safety_review' ? '监护人确认后恢复' : '暂停训练',
              ),
            ),
          ),
          const SizedBox(height: 8),
          ...dayItems.values.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '第 ${item.day} 天 · ${item.exerciseName} · ${item.durationMinutes.toStringAsFixed(0)} 分钟',
                    ),
                  ),
                  TextButton(
                    onPressed: workingDay == item.day
                        ? null
                        : () => onCheckIn(item.day),
                    child: workingDay == item.day
                        ? const SizedBox(
                            height: 16,
                            width: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('打卡'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          const Text('安全提醒', style: TextStyle(fontWeight: FontWeight.bold)),
          ...firstWeek
              .map((item) => item.stopCondition)
              .toSet()
              .map(
                (note) => Text(note, style: const TextStyle(color: boksMuted)),
              ),
        ],
      ),
    );
  }
}

class PostureConsentScreen extends StatefulWidget {
  const PostureConsentScreen({required this.client, super.key});

  final BoksApiClient client;

  @override
  State<PostureConsentScreen> createState() => _PostureConsentScreenState();
}

class _PostureConsentScreenState extends State<PostureConsentScreen> {
  late Future<List<Child>> _children;
  String? _childId;
  bool _consent = false;
  bool _starting = false;

  @override
  void initState() {
    super.initState();
    _children = widget.client.listChildren().then((items) {
      return widget.client.resolveSelectedChildId(items).then((selected) {
        _childId = selected;
        return items;
      });
    });
  }

  Future<void> _start() async {
    if (_childId == null || !_consent) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('请选择孩子并完成监护人确认。')));
      return;
    }
    setState(() => _starting = true);
    try {
      final session = await widget.client.createPostureSession(_childId!);
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) =>
              PostureCaptureScreen(client: widget.client, session: session),
        ),
      );
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('体态观察授权')),
      body: FutureBuilder<List<Child>>(
        future: _children,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorPanel(message: snapshot.error.toString());
          }
          final children = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const DangerCard(
                message: '这是非诊断性的姿态观察，不替代医生、影像检查或医疗诊断。照片质量不足时不会生成风险结论。',
              ),
              if (children.isEmpty)
                const DangerCard(message: '还没有儿童档案，请先添加儿童。')
              else ...[
                DropdownButtonFormField<String>(
                  initialValue: _childId,
                  decoration: const InputDecoration(labelText: '选择孩子'),
                  items: children
                      .map(
                        (child) => DropdownMenuItem(
                          value: child.id,
                          child: Text(child.displayName),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    setState(() => _childId = value);
                    unawaited(widget.client.setSelectedChildId(value));
                  },
                ),
                const SizedBox(height: 16),
                const SectionCard(
                  title: '拍摄和数据用途',
                  child: Text(
                    '照片只用于本次 BOKS 体态观察任务和报告生成。请在光线均匀、背景简单的位置完成正面、左侧、右侧、背面拍摄。',
                  ),
                ),
                CheckboxListTile(
                  value: _consent,
                  onChanged: (value) =>
                      setState(() => _consent = value ?? false),
                  title: const Text('我确认已阅读说明，并有权代表孩子作出本次授权。'),
                  contentPadding: EdgeInsets.zero,
                ),
                ElevatedButton(
                  onPressed: _starting ? null : _start,
                  child: _starting
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('同意并开始拍摄'),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class PostureCaptureScreen extends StatefulWidget {
  const PostureCaptureScreen({
    required this.client,
    required this.session,
    super.key,
  });

  final BoksApiClient client;
  final PostureSession session;

  @override
  State<PostureCaptureScreen> createState() => _PostureCaptureScreenState();
}

class _PostureCaptureScreenState extends State<PostureCaptureScreen> {
  final ImagePicker _picker = ImagePicker();
  late PostureSession _session;
  var _viewIndex = 0;
  var _working = false;
  static const _labels = <String, String>{
    'front': '正面',
    'back': '背面',
    'left': '左侧',
    'right': '右侧',
  };

  @override
  void initState() {
    super.initState();
    _session = widget.session;
    _viewIndex = _firstMissingIndex(_session);
  }

  int _firstMissingIndex(PostureSession session) {
    final index = session.requiredViews.indexWhere(
      (view) => !session.attachedViews.contains(view),
    );
    return index < 0 ? session.requiredViews.length - 1 : index;
  }

  Future<void> _capture() async {
    if (_session.requiredViews.isEmpty) return;
    final view = _session.requiredViews[_viewIndex];
    setState(() => _working = true);
    try {
      final file = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 80,
      );
      if (file == null) return;
      final updated = await widget.client.uploadPostureView(
        _session.id,
        view,
        bytes: await file.readAsBytes(),
        fileName: file.name,
      );
      if (!mounted) return;
      setState(() {
        _session = updated;
        _viewIndex = _firstMissingIndex(updated);
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('${_labels[view]}照片已上传。')));
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _submit() async {
    setState(() => _working = true);
    try {
      final updated = await widget.client.submitPostureSession(_session.id);
      if (!mounted) return;
      setState(() => _session = updated);
      final reportId = updated.analysis?.reportId;
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('体态任务状态'),
          content: Text(
            updated.qualityOverall == 'passed'
                ? '四个视角质量检查通过，已生成非诊断性观察报告。'
                : '视角尚未完整，请补齐后再提交。',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('知道了'),
            ),
          ],
        ),
      );
      if (reportId != null && mounted) {
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) =>
                PostureReportScreen(client: widget.client, reportId: reportId),
          ),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final view = _session.requiredViews[_viewIndex];
    return Scaffold(
      appBar: AppBar(title: const Text('四视角拍摄')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            '第 ${_viewIndex + 1} / ${_session.requiredViews.length} 个视角：${_labels[view]}',
          ),
          const SizedBox(height: 12),
          Row(
            children: _session.requiredViews
                .map(
                  (item) => Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: StatusPill(
                        label: _session.attachedViews.contains(item)
                            ? '${_labels[item]} ✓'
                            : _labels[item]!,
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 16),
          Container(
            height: 300,
            decoration: BoxDecoration(
              color: boksBrandLight,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: boksBrand),
            ),
            child: const Center(
              child: Icon(Icons.accessibility_new, size: 120, color: boksBrand),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            '请让孩子自然站立，保持光线均匀、背景简单。拍摄权限只在点击拍摄后申请。',
            style: TextStyle(color: boksMuted),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _working ? null : _capture,
            child: Text('拍摄并登记${_labels[view]}照片'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: _working ? null : _submit,
            child: const Text('提交体态观察任务'),
          ),
          const SizedBox(height: 12),
          Text(
            '已上传 ${_session.attachedViews.length} / ${_session.requiredViews.length} 个视角。照片仅用于本次体态观察任务。',
            textAlign: TextAlign.center,
            style: const TextStyle(color: boksMuted, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class PostureReportScreen extends StatelessWidget {
  const PostureReportScreen({
    required this.client,
    required this.reportId,
    super.key,
  });

  final BoksApiClient client;
  final String reportId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('体态观察报告')),
      body: FutureBuilder<PostureReport>(
        future: client.getPostureReport(reportId),
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorPanel(message: snapshot.error.toString());
          }
          final report = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const DangerCard(
                message: '普通照片不能诊断疾病，也不能测量 Cobb 角。本报告是非诊断性观察，当前版本会明确标记数据和模型限制。',
              ),
              Card(
                color: boksBrand,
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      const Text('当前能力', style: TextStyle(color: Colors.white)),
                      Text(
                        '未分级',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 48,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        '当前仅完成照片任务质量检查，不输出姿态风险等级。',
                        style: const TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                ),
              ),
              SectionCard(
                title: '观察结果',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: report.observations
                      .map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(item),
                        ),
                      )
                      .toList(),
                ),
              ),
              SectionCard(
                title: '建议',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: report.recommendations
                      .map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(item),
                        ),
                      )
                      .toList(),
                ),
              ),
              SectionCard(
                title: '限制说明',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: report.limitations
                      .map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(
                            item,
                            style: const TextStyle(color: boksMuted),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class ChatScreen extends StatefulWidget {
  const ChatScreen({required this.client, super.key});

  final BoksApiClient client;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  late Future<void> _ready;
  final TextEditingController _controller = TextEditingController();
  List<Child> _children = [];
  List<ChatMessage> _messages = [];
  String? _childId;
  String? _conversationId;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _ready = _initialize();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _initialize() async {
    final results = await Future.wait<dynamic>([
      widget.client.listChildren(),
      widget.client.createConversation(),
    ]);
    _children = results[0] as List<Child>;
    final conversation = results[1] as ChatConversation;
    _messages = conversation.messages;
    _conversationId = conversation.id;
    _childId = await widget.client.resolveSelectedChildId(_children);
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    final conversationId = _conversationId;
    if (text.isEmpty || conversationId == null) return;
    setState(() => _sending = true);
    try {
      final message = await widget.client.sendChatMessage(
        conversationId,
        content: text,
        childId: _childId,
      );
      setState(() {
        _messages = [
          ..._messages,
          ChatMessage(
            id: 'local-user-${DateTime.now().microsecondsSinceEpoch}',
            role: 'user',
            content: text,
            citations: const [],
            createdAt: DateTime.now().toIso8601String(),
          ),
          message,
        ];
        _controller.clear();
      });
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('专业咨询')),
      body: FutureBuilder<void>(
        future: _ready,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorPanel(message: snapshot.error.toString());
          }
          return Column(
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: DangerCard(
                  message:
                      '只回答 BOKS 体测、训练、体态观察和隐私流程，不提供诊断或处方。出现疼痛、麻木、无力或急症请停止训练并及时就医。',
                ),
              ),
              if (_children.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: DropdownButtonFormField<String>(
                    initialValue: _childId,
                    decoration: const InputDecoration(labelText: '咨询对象'),
                    items: _children
                        .map(
                          (child) => DropdownMenuItem(
                            value: child.id,
                            child: Text(child.displayName),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      setState(() => _childId = value);
                      unawaited(widget.client.setSelectedChildId(value));
                    },
                  ),
                ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: _messages.isEmpty
                      ? const [
                          Text(
                            '可以问：如何看体测报告？如何安排训练？体态照片有哪些拍摄要求？',
                            style: TextStyle(color: boksMuted),
                          ),
                        ]
                      : _messages
                            .map(
                              (message) => Align(
                                alignment: message.role == 'user'
                                    ? Alignment.centerRight
                                    : Alignment.centerLeft,
                                child: Card(
                                  color: message.role == 'user'
                                      ? boksBrandLight
                                      : null,
                                  child: Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(message.content),
                                        if (message.citations.isNotEmpty)
                                          Text(
                                            '依据：${message.citations.map((item) => '${item.title}（${item.version}）').join('、')}',
                                            style: const TextStyle(
                                              color: boksMuted,
                                              fontSize: 12,
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            )
                            .toList(),
                ),
              ),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _controller,
                          minLines: 1,
                          maxLines: 4,
                          decoration: const InputDecoration(
                            hintText: '请输入想咨询的问题',
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: _sending ? null : _send,
                        child: const Text('发送'),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class DataControlScreen extends StatefulWidget {
  const DataControlScreen({required this.client, super.key});

  final BoksApiClient client;

  @override
  State<DataControlScreen> createState() => _DataControlScreenState();
}

class _DataControlScreenState extends State<DataControlScreen> {
  late Future<List<Child>> _children;

  @override
  void initState() {
    super.initState();
    _children = widget.client.listChildren();
  }

  Future<void> _export() async {
    try {
      final data = await widget.client.exportFamily();
      await Clipboard.setData(ClipboardData(text: jsonEncode(data)));
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('家庭数据已复制到剪贴板。')));
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  Future<void> _requestDeletion(Child child) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('申请删除儿童数据'),
        content: Text('将为${child.displayName}提交删除申请，报告、训练和体态任务会进入清理流程。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('提交申请'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await widget.client.requestChildDeletion(child.id);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('删除申请已提交。')));
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('数据控制与导出')),
      body: FutureBuilder<List<Child>>(
        future: _children,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorPanel(message: snapshot.error.toString());
          }
          final children = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const SectionCard(
                title: '监护人控制',
                child: Text('你可以导出当前家庭数据，或为某个儿童提交删除申请。删除会保留必要的最小审计记录。'),
              ),
              FilledButton.icon(
                onPressed: _export,
                icon: const Icon(Icons.download_outlined),
                label: const Text('导出家庭数据'),
              ),
              const SizedBox(height: 16),
              ...children.map(
                (child) => Card(
                  child: ListTile(
                    title: Text(child.displayName),
                    subtitle: const Text('报告、训练和体态任务'),
                    trailing: TextButton(
                      onPressed: () => _requestDeletion(child),
                      child: const Text('申请删除'),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('隐私与数据说明')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          SectionCard(
            title: 'BOKS 自有学生和家长专用',
            child: Text('数据由监护人主动提供，用于家庭体测报告、训练建议和体态拍摄任务。'),
          ),
          SectionCard(
            title: '照片和权限',
            child: Text('相机仅在监护人完成用途确认并主动点击拍摄后申请。音频、照片不在后台持续采集。'),
          ),
          SectionCard(
            title: '重要限制',
            child: Text('体态首版为非诊断性观察；开发环境评分为演示夹具，正式上线前需完成标准和算法审核。'),
          ),
        ],
      ),
    );
  }
}

class _HomeSectionHeading extends StatelessWidget {
  const _HomeSectionHeading({
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Text(title, style: Theme.of(context).textTheme.titleMedium),
        ),
        if (actionLabel != null && onAction != null)
          TextButton(onPressed: onAction, child: Text(actionLabel!))
        else if (actionLabel != null)
          Text(
            actionLabel!,
            style: const TextStyle(color: boksMuted, fontSize: 12),
          ),
      ],
    );
  }
}

class _HomeReportCard extends StatelessWidget {
  const _HomeReportCard({
    required this.report,
    required this.levelLabel,
    required this.onOpen,
  });

  final AssessmentReport? report;
  final String? levelLabel;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    if (report == null) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.insights_outlined, color: boksBrand),
                  SizedBox(width: 10),
                  Text(
                    '还没有体测记录',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                '完成一次真实测量后，这里会显示孩子的标准版本、结果和优先行动。',
                style: TextStyle(color: boksMuted, height: 1.45),
              ),
              const SizedBox(height: 14),
              FilledButton(onPressed: onOpen, child: const Text('开始第一次体测')),
            ],
          ),
        ),
      );
    }

    return Card(
      color: boksForest,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Expanded(
                  child: Row(
                    children: [
                      Icon(Icons.assessment_outlined, color: Colors.white),
                      SizedBox(width: 10),
                      Text(
                        '国家标准体测报告',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 17,
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      report!.totalScore?.toStringAsFixed(1) ?? '—',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 34,
                        fontWeight: FontWeight.w900,
                        height: 1,
                      ),
                    ),
                    Text(
                      report!.totalScore == null ? '参考进步' : '$levelLabel · 综合分',
                      style: const TextStyle(
                        color: Color(0xCCFFFFFF),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '${report!.measurementDate} · ${report!.standardName}',
              style: const TextStyle(color: Color(0xD9FFFFFF), fontSize: 12),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.only(top: 13),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: Color(0x33FFFFFF))),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '优先改善行动',
                    style: TextStyle(
                      color: Color(0xD9FFFFFF),
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  ...report!.priorityActions
                      .take(3)
                      .map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text(
                            item,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              height: 1.35,
                            ),
                          ),
                        ),
                      ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: onOpen,
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: boksForest,
                    ),
                    child: const Text('查看完整报告'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeTrainingCard extends StatelessWidget {
  const _HomeTrainingCard({
    required this.plan,
    required this.progress,
    required this.onOpen,
  });

  final TrainingPlan? plan;
  final TrainingProgress? progress;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    if (plan == null) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const DecoratedBox(
                decoration: BoxDecoration(
                  color: boksBrandLight,
                  shape: BoxShape.circle,
                ),
                child: Padding(
                  padding: EdgeInsets.all(10),
                  child: Icon(Icons.directions_run, color: boksBrand),
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  '完成体测后，BOKS 会根据当前数据生成可执行的家庭训练计划。',
                  style: TextStyle(color: boksMuted, height: 1.45),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final completed = progress?.completed ?? 0;
    final total = progress?.totalDays ?? 0;
    final percent = total == 0 ? 0.0 : (completed / total).clamp(0.0, 1.0);
    final firstItem = plan!.items.isEmpty ? null : plan!.items.first;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const DecoratedBox(
                  decoration: BoxDecoration(
                    color: boksBrandLight,
                    shape: BoxShape.circle,
                  ),
                  child: Padding(
                    padding: EdgeInsets.all(10),
                    child: Icon(Icons.directions_run, color: boksBrand),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        plan!.goal,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${plan!.durationWeeks} 周 · 每周 ${plan!.daysPerWeek} 次 · 每次约 ${plan!.minutesPerSession} 分钟',
                        style: const TextStyle(color: boksMuted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Text(
                  '$completed/$total',
                  style: const TextStyle(
                    color: boksBrand,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                value: percent,
                minHeight: 8,
                backgroundColor: boksBrandLight,
                valueColor: const AlwaysStoppedAnimation(boksBrandBright),
              ),
            ),
            if (firstItem != null) ...[
              const SizedBox(height: 14),
              Text(
                '今日建议 · ${firstItem.exerciseName}',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 3),
              Text(
                '约 ${firstItem.durationMinutes.toStringAsFixed(0)} 分钟 · 训练时如不适请立即停止',
                style: const TextStyle(color: boksMuted, fontSize: 12),
              ),
            ],
            const SizedBox(height: 14),
            OutlinedButton(onPressed: onOpen, child: const Text('打开训练计划')),
          ],
        ),
      ),
    );
  }
}

class ActionTile extends StatelessWidget {
  const ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.accentColor = boksBrandLight,
    super.key,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  color: accentColor,
                  shape: BoxShape.circle,
                ),
                child: Padding(
                  padding: const EdgeInsets.all(9),
                  child: Icon(icon, color: boksBrand, size: 24),
                ),
              ),
              const SizedBox(height: 10),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: const TextStyle(color: boksMuted, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ActionButton extends StatelessWidget {
  const ActionButton({
    required this.label,
    required this.onPressed,
    this.icon,
    super.key,
  });

  final String label;
  final VoidCallback onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: icon == null ? null : Icon(icon, color: boksBrand),
      title: Text(label),
      trailing: const Icon(Icons.chevron_right),
      onTap: onPressed,
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({
    required this.label,
    this.backgroundColor = boksBrandLight,
    this.foregroundColor = boksBrand,
    super.key,
  });

  final String label;
  final Color backgroundColor;
  final Color foregroundColor;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(
          label,
          style: TextStyle(color: foregroundColor, fontSize: 12),
        ),
      ),
    );
  }
}

class DangerCard extends StatelessWidget {
  const DangerCard({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFFFFF4F2),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Text(message, style: const TextStyle(color: Color(0xFFB42318))),
      ),
    );
  }
}

class SectionCard extends StatelessWidget {
  const SectionCard({required this.title, required this.child, super.key});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }
}

class ErrorPanel extends StatelessWidget {
  const ErrorPanel({required this.message, this.onRetry, super.key});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center),
            if (onRetry != null) ...[
              const SizedBox(height: 12),
              OutlinedButton(onPressed: onRetry, child: const Text('重新加载')),
            ],
          ],
        ),
      ),
    );
  }
}
