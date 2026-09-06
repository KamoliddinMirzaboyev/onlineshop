import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../models/user.dart';
import '../services/api.dart';
import '../services/cart.dart';
import '../widgets/common.dart';
import '../widgets/toast.dart';
import 'auth_page.dart';
import 'contact_page.dart';

enum _EditField { name, lastName, phone }

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  User? _user;
  List<Map<String, dynamic>> _addresses = [];
  bool _loading = true;
  bool _showAddrForm = false;
  final _addrController = TextEditingController();

  _EditField? _editField;
  final _editController = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _addrController.dispose();
    _editController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final me = await api.get('/auth/me');
      final addrs = await api.get('/addresses');
      setState(() {
        _user = User.fromJson(me);
        _addresses = List<Map<String, dynamic>>.from(addrs);
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _startEdit(_EditField field) {
    setState(() {
      _editField = field;
      _editController.text = switch (field) {
        _EditField.name => _user?.firstName ?? '',
        _EditField.lastName => _user?.lastName ?? '',
        _EditField.phone => _user?.phone ?? '',
      };
    });
  }

  Future<void> _saveEdit() async {
    if (_editField == null || _saving) return;
    final key = switch (_editField!) {
      _EditField.name => 'first_name',
      _EditField.lastName => 'last_name',
      _EditField.phone => 'phone',
    };
    setState(() => _saving = true);
    try {
      final res = await api.patch('/auth/me', {key: _editController.text.trim()});
      setState(() {
        _user = User.fromJson(res);
        _editField = null;
      });
    } catch (e) {
      toast.error(_editField == _EditField.phone ? 'Bu telefon band bo\'lishi mumkin' : 'Saqlab bo\'lmadi');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _addAddress() async {
    if (_addrController.text.trim().isEmpty) return;
    try {
      await api.post('/addresses', {'label': 'Uy', 'address_line': _addrController.text.trim()});
      _addrController.clear();
      setState(() => _showAddrForm = false);
      _load();
    } catch (_) {
      toast.error('Manzilni saqlab bo\'lmadi');
    }
  }

  Future<void> _deleteAddress(int id) async {
    try {
      await api.delete('/addresses/$id');
      _load();
    } catch (_) {
      toast.error('O\'chirib bo\'lmadi');
    }
  }

  Future<void> _logout() async {
    await api.setToken(null);
    if (!mounted) return;
    // Keyingi foydalanuvchi shu qurilmada kirsa, avvalgisining savatchasi
    // ko'chib qolmasin (Cart/StoreProvider ilova ildizida bitta marta yaratiladi).
    context.read<CartProvider>().clear();
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const AuthPage()),
      (r) => false,
    );
  }

  String _initials(String? name) {
    if (name == null || name.trim().isEmpty) return '?';
    return name.trim()[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: EdgeInsets.zero,
                children: [
                  const PageHeader(title: 'Profil'),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
                    child: Row(
                      children: [
                        Container(
                          width: 60,
                          height: 60,
                          decoration: const BoxDecoration(color: AppColors.slate900, shape: BoxShape.circle),
                          alignment: Alignment.center,
                          child: Text(_initials(_user?.firstName),
                              style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w600)),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                [_user?.firstName, _user?.lastName].where((s) => s != null && s.isNotEmpty).join(' '),
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.slate900),
                              ),
                              const SizedBox(height: 2),
                              Text(_user?.phone ?? '', style: const TextStyle(color: AppColors.slate400, fontSize: 13)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: AppCard(
                      padding: EdgeInsets.zero,
                      child: Column(
                        children: [
                          _EditableRow(
                            label: 'Ism',
                            value: _user?.firstName ?? '—',
                            editing: _editField == _EditField.name,
                            controller: _editController,
                            saving: _saving,
                            onTap: () => _startEdit(_EditField.name),
                            onSave: _saveEdit,
                            onCancel: () => setState(() => _editField = null),
                          ),
                          const Divider(height: 1, color: AppColors.slate100, indent: 16, endIndent: 16),
                          _EditableRow(
                            label: 'Familiya',
                            value: (_user?.lastName?.isNotEmpty ?? false) ? _user!.lastName! : '—',
                            editing: _editField == _EditField.lastName,
                            controller: _editController,
                            saving: _saving,
                            onTap: () => _startEdit(_EditField.lastName),
                            onSave: _saveEdit,
                            onCancel: () => setState(() => _editField = null),
                          ),
                          const Divider(height: 1, color: AppColors.slate100, indent: 16, endIndent: 16),
                          _EditableRow(
                            label: 'Telefon',
                            value: _user?.phone ?? '—',
                            editing: _editField == _EditField.phone,
                            controller: _editController,
                            saving: _saving,
                            keyboardType: TextInputType.phone,
                            onTap: () => _startEdit(_EditField.phone),
                            onSave: _saveEdit,
                            onCancel: () => setState(() => _editField = null),
                          ),
                          const Divider(height: 1, color: AppColors.slate100, indent: 16, endIndent: 16),
                          InkWell(
                            onTap: () => setState(() => _showAddrForm = !_showAddrForm),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                              child: Row(
                                children: [
                                  const Text('Manzil', style: TextStyle(color: AppColors.slate900)),
                                  const Spacer(),
                                  Flexible(
                                    child: Text(
                                      _addresses.isNotEmpty ? (_addresses.first['address_line'] ?? '') : 'Kiritilmagan',
                                      style: const TextStyle(color: AppColors.slate400),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_showAddrForm)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                      child: AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            for (final a in _addresses)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 4),
                                child: Row(
                                  children: [
                                    Expanded(child: Text(a['address_line'] ?? '', style: const TextStyle(fontSize: 13))),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.slate400),
                                      onPressed: () => _deleteAddress(a['id'] as int),
                                    ),
                                  ],
                                ),
                              ),
                            Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _addrController,
                                    decoration: const InputDecoration(hintText: 'Manzilingiz', isDense: true, border: OutlineInputBorder()),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                AppButton(label: 'Qo\'shish', onPressed: _addAddress),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                    child: AppCard(
                      padding: EdgeInsets.zero,
                      child: InkWell(
                        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ContactPage())),
                        child: const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          child: Row(
                            children: [
                              Icon(Icons.headset_mic_rounded, size: 18, color: AppColors.slate400),
                              SizedBox(width: 12),
                              Text('Texnik qo\'llab-quvvatlash', style: TextStyle(color: AppColors.slate900)),
                              Spacer(),
                              Icon(Icons.chevron_right, size: 18, color: AppColors.slate400),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (_user?.createdAt != null)
                    Padding(
                      padding: const EdgeInsets.all(20),
                      child: Text(
                        'Ro\'yxatdan o\'tgan: ${formatDay(_user!.createdAt!)}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.slate400, fontSize: 12),
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    child: GhostButton(label: 'Chiqish', expand: true, onPressed: _logout),
                  ),
                ],
              ),
      ),
    );
  }
}

class _EditableRow extends StatelessWidget {
  const _EditableRow({
    required this.label,
    required this.value,
    required this.editing,
    required this.controller,
    required this.saving,
    required this.onTap,
    required this.onSave,
    required this.onCancel,
    this.keyboardType,
  });
  final String label;
  final String value;
  final bool editing;
  final TextEditingController controller;
  final bool saving;
  final VoidCallback onTap;
  final VoidCallback onSave;
  final VoidCallback onCancel;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    if (editing) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                autofocus: true,
                keyboardType: keyboardType,
                decoration: const InputDecoration(isDense: true, border: OutlineInputBorder()),
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              icon: saving
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.check, color: AppColors.brand),
              onPressed: saving ? null : onSave,
            ),
            IconButton(icon: const Icon(Icons.close, color: AppColors.slate400), onPressed: onCancel),
          ],
        ),
      );
    }
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Text(label, style: const TextStyle(color: AppColors.slate900)),
            const Spacer(),
            Text(value, style: const TextStyle(color: AppColors.slate400)),
          ],
        ),
      ),
    );
  }
}
