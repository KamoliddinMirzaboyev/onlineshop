import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme.dart';

/// 5 ta alohida katakchali SMS-kod input. Bir katakchaga kod paste qilinsa —
/// hammasi avtomatik to'ladi. To'lgach `onCompleted` chaqiriladi.
class OtpBoxInput extends StatefulWidget {
  const OtpBoxInput({
    super.key,
    this.length = 5,
    required this.onChanged,
    this.onCompleted,
  });

  final int length;
  final ValueChanged<String> onChanged;
  final ValueChanged<String>? onCompleted;

  @override
  State<OtpBoxInput> createState() => _OtpBoxInputState();
}

class _OtpBoxInputState extends State<OtpBoxInput> {
  late final _controllers = List.generate(widget.length, (_) => TextEditingController());
  late final _focusNodes = List.generate(widget.length, _buildFocusNode);

  FocusNode _buildFocusNode(int i) => FocusNode(
        onKeyEvent: (node, event) {
          if (event is KeyDownEvent &&
              event.logicalKey == LogicalKeyboardKey.backspace &&
              _controllers[i].text.isEmpty &&
              i > 0) {
            _controllers[i - 1].clear();
            _focusNodes[i - 1].requestFocus();
            _notify();
            return KeyEventResult.handled;
          }
          return KeyEventResult.ignored;
        },
      );

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  String get _code => _controllers.map((c) => c.text).join();

  void _notify() {
    final code = _code;
    widget.onChanged(code);
    if (code.length == widget.length) widget.onCompleted?.call(code);
  }

  void _onChanged(int i, String value) {
    // Bir nechta belgi bir yo'la kelsa — paste qilingan (yoki autofill).
    // Barcha katakchalarni shu kod bilan to'ldiramiz.
    if (value.length > 1) {
      final digits = value.replaceAll(RegExp(r'\D'), '');
      for (var j = 0; j < widget.length; j++) {
        _controllers[j].text = j < digits.length ? digits[j] : '';
      }
      final last = digits.length.clamp(0, widget.length) - 1;
      if (last >= 0) _focusNodes[last].requestFocus();
      _notify();
      return;
    }

    if (value.isNotEmpty && i < widget.length - 1) {
      _focusNodes[i + 1].requestFocus();
    }
    _notify();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        for (var i = 0; i < widget.length; i++)
          SizedBox(
            width: 52,
            height: 56,
            child: TextField(
              controller: _controllers[i],
              focusNode: _focusNodes[i],
              autofocus: i == 0,
              textAlign: TextAlign.center,
              keyboardType: TextInputType.number,
              maxLength: widget.length, // paste qilinganda to'liq kodni ushlab qolish uchun
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppColors.slate900),
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: InputDecoration(
                counterText: '',
                contentPadding: EdgeInsets.zero,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.slate200),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.brand, width: 2),
                ),
              ),
              onChanged: (v) => _onChanged(i, v),
            ),
          ),
      ],
    );
  }
}
