import 'package:flutter_test/flutter_test.dart';
import 'package:kuryer/core/format.dart';

/// Dart port of the courier web `src/test/format.test.ts` +
/// `orderActions.test.ts`, so the shared formatting/logic stays in lock-step.

const _acceptable = {'pending', 'confirmed', 'preparing', 'ready'};
bool isAcceptableOrderStatus(String s) => _acceptable.contains(s);

void main() {
  group('money', () {
    test('formats number with spaces', () {
      expect(money(1000), '1 000');
      expect(money(1234567), '1 234 567');
      expect(money(0), '0');
    });
  });

  group('formatDateTime', () {
    test('formats ISO string', () {
      expect(formatDateTime('2026-06-30T12:00:00Z'), contains('.06'));
    });
  });

  group('formatDay', () {
    test('formats as day + short month', () {
      expect(formatDay('2026-06-30'), contains('30'));
    });
  });

  group('statusLabel', () {
    test('returns label for known status', () {
      expect(statusLabel('pending'), 'Yangi');
      expect(statusLabel('accepted'), 'Qabul qilindi');
      expect(statusLabel('delivering'), 'Yetkazilmoqda');
      expect(statusLabel('delivered'), 'Yetkazildi');
      expect(statusLabel('cancelled'), 'Bekor qilindi');
    });

    test('falls back to the status value for unknown', () {
      expect(statusLabel('unknown'), 'unknown');
    });
  });

  group('paymentLabel', () {
    test('returns Uzbek label', () {
      expect(paymentLabel('cash'), 'Naqd');
      expect(paymentLabel('payme'), 'Payme');
    });

    test('returns dash for null', () {
      expect(paymentLabel(null), '—');
    });
  });

  group('mapsUrl / navigation', () {
    test('yandex maps URL from coords', () {
      final url = mapsUrl(41.3, 69.2);
      expect(url, contains('yandex.com/maps'));
      expect(url, contains('rtext=~41.3,69.2'));
    });

    test('google maps nav URL', () {
      final url = googleMapsNavUrl(lat: 41.3, lng: 69.2);
      expect(url, contains('google.com/maps'));
      expect(url, contains('destination=41.3,69.2'));
    });

    test('yandex navi deep link', () {
      final url = yandexNaviUrl(lat: 41.3, lng: 69.2);
      expect(url, startsWith('yandexnavi://'));
      expect(url, contains('lat_to=41.3'));
    });

    test('returns null if lat/lng missing', () {
      expect(mapsUrl(null, null), isNull);
      expect(googleMapsNavUrl(), isNull);
      expect(yandexNaviUrl(), isNull);
    });

    test('canNavigate with address only', () {
      expect(canNavigate(address: 'Fargona'), isTrue);
      expect(canNavigate(), isFalse);
    });
  });

  group('qtyUnit', () {
    test('uses provided unit', () {
      expect(qtyUnit(2, 'kg'), '2 kg');
      expect(qtyUnit(1, 'dona'), '1 dona');
    });

    test("defaults to 'dona' when unit missing", () {
      expect(qtyUnit(5, null), '5 dona');
      expect(qtyUnit(3, ''), '3 dona');
    });
  });

  group('distanceLabel', () {
    test('shows km for >= 1 km', () {
      expect(distanceLabel(4.2), '4.2 km');
      expect(distanceLabel(1.0), '1.0 km');
    });

    test('shows meters for < 1 km', () {
      expect(distanceLabel(0.85), '850 m');
      expect(distanceLabel(0.05), '50 m');
    });

    test('returns null for null', () {
      expect(distanceLabel(null), isNull);
    });
  });

  group('etaLabel', () {
    test('formats with ~ prefix', () {
      expect(etaLabel(25), '~25 daqiqa');
      expect(etaLabel(10), '~10 daqiqa');
    });

    test('returns null for null/0', () {
      expect(etaLabel(null), isNull);
      expect(etaLabel(0), isNull);
    });
  });

  group('isAcceptableOrderStatus', () {
    test('allows fresh and preparation-stage orders', () {
      expect(isAcceptableOrderStatus('pending'), true);
      expect(isAcceptableOrderStatus('confirmed'), true);
      expect(isAcceptableOrderStatus('preparing'), true);
      expect(isAcceptableOrderStatus('ready'), true);
    });

    test('hides accept action once claimed or finished', () {
      expect(isAcceptableOrderStatus('accepted'), false);
      expect(isAcceptableOrderStatus('delivering'), false);
      expect(isAcceptableOrderStatus('delivered'), false);
      expect(isAcceptableOrderStatus('cancelled'), false);
    });
  });
}
