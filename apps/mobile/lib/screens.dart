import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter/services.dart';

import 'api_client.dart';
import 'models.dart';
import 'theme.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({required this.client, super.key});

  final BoksApiClient client;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<Family> _family;

  @override
  void initState() {
    super.initState();
    _family = widget.client.getFamily();
  }

  void _reload() {
    setState(() => _family = widget.client.getFamily());
  }

  void _open(Widget page) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('BOKS')),
      body: FutureBuilder<Family>(
        future: _family,
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
          final family = snapshot.data!;
          final child = family.children.isEmpty ? null : family.children.first;
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  '你好，BOKS 家庭',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 4),
                const Text(
                  '记录成长，用科学训练陪伴孩子变得更强健。',
                  style: TextStyle(color: boksMuted),
                ),
                const SizedBox(height: 20),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '本周概览',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          child == null
                              ? '先添加孩子档案，再开始第一次体测'
                              : '已为 ${child.displayName} 建立成长档案',
                          style: const TextStyle(color: boksMuted),
                        ),
                        const SizedBox(height: 12),
                        const StatusPill(label: '家庭数据由监护人维护'),
                      ],
                    ),
                  ),
                ),
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 1.1,
                  children: [
                    ActionTile(
                      icon: Icons.assessment_outlined,
                      title: '开始体测',
                      subtitle: '录入项目并生成报告',
                      onTap: () =>
                          _open(AssessmentStartScreen(client: widget.client)),
                    ),
                    ActionTile(
                      icon: Icons.accessibility_new,
                      title: '体态观察',
                      subtitle: '授权后完成四视角拍摄',
                      onTap: () =>
                          _open(PostureConsentScreen(client: widget.client)),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Card(
                  child: Column(
                    children: [
                      ActionButton(
                        label: '查看体测报告',
                        onPressed: () =>
                            _open(ReportListScreen(client: widget.client)),
                      ),
                      ActionButton(
                        label: '查看训练计划',
                        onPressed: () =>
                            _open(TrainingScreen(client: widget.client)),
                      ),
                      ActionButton(
                        label: '管理儿童档案',
                        onPressed: () =>
                            _open(FamilyScreen(client: widget.client)),
                      ),
                      ActionButton(
                        label: '专业咨询',
                        onPressed: () =>
                            _open(ChatScreen(client: widget.client)),
                      ),
                      ActionButton(
                        label: '数据控制与导出',
                        onPressed: () =>
                            _open(DataControlScreen(client: widget.client)),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: () => _open(const PrivacyScreen()),
                  child: const Text('隐私与数据说明'),
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
  const FamilyScreen({required this.client, super.key});

  final BoksApiClient client;

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
            return const Center(child: Text('还没有儿童档案。'));
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: children
                .map(
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
                        label: child.profileStatus == 'active' ? '正常' : '已停用',
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
      _childId = items.isEmpty ? null : items.first.id;
      return items;
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
                  onChanged: (value) => setState(() => _childId = value),
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
      _childId =
          widget.initialChildId ?? (items.isEmpty ? null : items.first.id);
      return items;
    });
    _loadPlans();
  }

  Future<void> _loadPlans() async {
    final childId = widget.initialChildId ?? _childId;
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
      _childId = items.isEmpty ? null : items.first.id;
      return items;
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
                  onChanged: (value) => setState(() => _childId = value),
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
      final updated = await widget.client.attachPostureView(
        _session.id,
        view,
        'android-$view-${DateTime.now().millisecondsSinceEpoch}',
      );
      if (!mounted) return;
      setState(() {
        _session = updated;
        _viewIndex = _firstMissingIndex(updated);
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('${_labels[view]}照片已登记。')));
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
            '已登记 ${_session.attachedViews.length} / ${_session.requiredViews.length} 个视角。开发版仅登记任务，不上传真实对象存储。',
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
          final riskLabel = const {
            'A': '未发现明显照片层面差异',
            'B': '需要改善拍摄条件或人工复核',
            'C': '建议家长安排专业人工复核',
            'D': '请停止训练并及时就医',
          }[report.riskLevel];
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
                      const Text('行动层级', style: TextStyle(color: Colors.white)),
                      Text(
                        report.riskLevel,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 48,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        riskLabel ?? '数据不足',
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
    _childId = _children.isEmpty ? null : _children.first.id;
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
                    onChanged: (value) => setState(() => _childId = value),
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

class ActionTile extends StatelessWidget {
  const ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    super.key,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

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
              Icon(icon, color: boksBrand, size: 30),
              const SizedBox(height: 10),
              Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
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
  const ActionButton({required this.label, required this.onPressed, super.key});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(label),
      trailing: const Icon(Icons.chevron_right),
      onTap: onPressed,
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({required this.label, super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: boksBrandLight,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(
          label,
          style: const TextStyle(color: boksBrand, fontSize: 12),
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
