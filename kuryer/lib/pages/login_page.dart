import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../services/notifications.dart';
import '../state/auth.dart';
import '../widgets/common.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  String _error = '';
  bool _loading = false;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _error = '';
      _loading = true;
    });
    try {
      await context.read<AuthState>().login(_username.text.trim(), _password.text);
      // Ask for the order-alert notification (login tap is a user gesture).
      // Best-effort — a refusal must not block entering the app.
      notifications.requestPermission();
      // Navigation handled by the root AuthGate listening to AuthState/token.
    } catch (err) {
      final raw = err.toString();
      setState(() {
        _error = raw.contains('Faqat kuryer')
            ? 'Faqat kuryer hisobi ruxsat etilgan / Доступ только для курьеров'
            : 'Login yoki parol xato / Неверный логин или пароль';
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 384),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Brand mark
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: AppColors.brand,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.brand.withValues(alpha: 0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.pedal_bike, size: 32, color: Colors.white),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Barakali Bozor',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Kuryer paneli',
                  style: TextStyle(fontSize: 14, color: AppColors.slate500),
                ),
                const SizedBox(height: 32),
                AppCard(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _label('Login'),
                        const SizedBox(height: 4),
                        _Field(
                          controller: _username,
                          hint: 'kuryer_login',
                          icon: Icons.person_outline,
                        ),
                        const SizedBox(height: 16),
                        _label('Parol'),
                        const SizedBox(height: 4),
                        _Field(
                          controller: _password,
                          hint: '••••••••',
                          icon: Icons.lock_outline,
                          obscure: true,
                        ),
                        if (_error.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF2F2),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              _error,
                              style: const TextStyle(color: AppColors.red600, fontSize: 13),
                            ),
                          ),
                        ],
                        const SizedBox(height: 16),
                        AppButton(
                          label: _loading ? 'Kirish…' : 'Kirish',
                          expand: true,
                          loading: _loading,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          onPressed: _loading ? null : _submit,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _label(String text) => Text(
        text,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: AppColors.slate700,
        ),
      );
}

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.hint,
    required this.icon,
    this.obscure = false,
  });

  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final bool obscure;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: obscure,
      validator: (v) => (v == null || v.isEmpty) ? '' : null,
      style: const TextStyle(fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.slate400, fontSize: 14),
        prefixIcon: Icon(icon, size: 18, color: AppColors.slate400),
        prefixIconConstraints: const BoxConstraints(minWidth: 40),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        errorStyle: const TextStyle(height: 0, fontSize: 0),
        filled: true,
        fillColor: Colors.white,
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.slate200),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.brand, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.slate200),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.brand, width: 1.5),
        ),
      ),
    );
  }
}
