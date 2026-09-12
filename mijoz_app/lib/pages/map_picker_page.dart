import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../core/theme.dart';
import '../services/api.dart';

const _margilon = LatLng(40.4718, 71.7247);

/// Xaritadan qo'lda joy tanlash — markazdagi pin, xaritani surib joy belgilanadi.
/// TMA'dagi `MapPicker` bilan bir xil mantiq: tasdiqlashdan oldin nuqta
/// yetkazish hududida ekani `/restaurants/nearest` orqali tekshiriladi.
class MapPickerPage extends StatefulWidget {
  const MapPickerPage({super.key, this.initialLat, this.initialLng});

  final double? initialLat;
  final double? initialLng;

  @override
  State<MapPickerPage> createState() => _MapPickerPageState();
}

class _MapPickerPageState extends State<MapPickerPage> {
  final _map = MapController();
  bool _checking = false;
  String? _error;

  LatLng get _initial => widget.initialLat != null && widget.initialLng != null
      ? LatLng(widget.initialLat!, widget.initialLng!)
      : _margilon;

  Future<void> _confirm() async {
    if (_checking) return;
    final c = _map.camera.center;
    setState(() {
      _checking = true;
      _error = null;
    });
    try {
      await api.get('/restaurants/nearest?lat=${c.latitude}&lng=${c.longitude}');
    } catch (e) {
      if (e.toString().contains('OUT_OF_RANGE')) {
        if (mounted) {
          setState(() {
            _checking = false;
            _error = 'Kechirasiz, hozircha sizning hududingizga xizmat ko\'rsata olmaymiz';
          });
        }
        return;
      }
      // Tarmoq xatosi — buyurtma berishda baribir tekshiriladi.
    }
    if (mounted) Navigator.of(context).pop(c);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          FlutterMap(
            mapController: _map,
            options: MapOptions(
              initialCenter: _initial,
              initialZoom: 17,
              maxZoom: 19,
              onPositionChanged: (_, __) {
                if (_error != null) setState(() => _error = null);
              },
            ),
            children: [
              // ponytail: OSM rasterlari — TMA'dagi Mapbox sputnik qatlami
              // token talab qiladi; kerak bo'lsa --dart-define bilan qo'shiladi.
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'uz.barakali.bozor',
                maxZoom: 19,
              ),
            ],
          ),

          // Markazdagi pin (xarita suriladi, pin joyida qoladi)
          IgnorePointer(
            child: Center(
              child: Padding(
                // Uchi aynan markazga tushsin
                padding: const EdgeInsets.only(bottom: 36),
                child: Icon(Icons.location_on, size: 44, color: AppColors.brand),
              ),
            ),
          ),

          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Align(
                alignment: Alignment.topLeft,
                child: Material(
                  color: Colors.white,
                  shape: const CircleBorder(),
                  elevation: 2,
                  child: IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ),
              ),
            ),
          ),

          Positioned(
            left: 16,
            right: 16,
            bottom: 24,
            child: SafeArea(
              top: false,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_error != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFFCA5A5)),
                      ),
                      child: Text(
                        _error!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.red600, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ),
                  const Text(
                    'Xaritani surib uyingiz ustiga belgilang',
                    style: TextStyle(fontSize: 12.5, color: AppColors.slate500, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.brand,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      onPressed: _checking ? null : _confirm,
                      child: _checking
                          ? const SizedBox(
                              width: 20, height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Shu yerni tanlash',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
