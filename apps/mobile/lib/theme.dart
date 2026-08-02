import 'package:flutter/material.dart';

const boksForest = Color(0xFF103E2F);
const boksForestDark = Color(0xFF0A2A20);
const boksBrand = Color(0xFF2E8B57);
const boksBrandBright = Color(0xFF4FAF68);
const boksBrandLight = Color(0xFFE8F6E6);
const boksSkyLight = Color(0xFFE5F3F7);
const boksAmberLight = Color(0xFFFFF1D0);
const boksCanvas = Color(0xFFEEF6EC);
const boksSurfaceSoft = Color(0xFFF7FBF6);
const boksInk = Color(0xFF142C25);
const boksMuted = Color(0xFF5B7168);
const boksBorder = Color(0xFFD7E6DB);

ThemeData buildBoksTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: boksBrand,
    brightness: Brightness.light,
  ).copyWith(
    primary: boksForest,
    onPrimary: Colors.white,
    secondary: boksBrand,
    onSecondary: Colors.white,
    surface: Colors.white,
    onSurface: boksInk,
    surfaceContainerHighest: boksSurfaceSoft,
    outline: boksBorder,
    error: const Color(0xFFB42318),
  );

  return ThemeData(
    colorScheme: scheme,
    scaffoldBackgroundColor: boksCanvas,
    useMaterial3: true,
    textTheme: const TextTheme(
      headlineSmall: TextStyle(
        color: boksInk,
        fontSize: 28,
        fontWeight: FontWeight.w800,
        height: 1.2,
        letterSpacing: -0.4,
      ),
      titleLarge: TextStyle(
        color: boksInk,
        fontSize: 22,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.3,
      ),
      titleMedium: TextStyle(
        color: boksInk,
        fontSize: 17,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.2,
      ),
      bodyLarge: TextStyle(color: boksInk, fontSize: 16, height: 1.5),
      bodyMedium: TextStyle(color: boksInk, fontSize: 14, height: 1.55),
      bodySmall: TextStyle(color: boksMuted, fontSize: 12, height: 1.45),
      labelLarge: TextStyle(fontWeight: FontWeight.w700, letterSpacing: 0.1),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      foregroundColor: boksInk,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: boksInk,
        fontSize: 20,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.2,
      ),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 16),
      shadowColor: const Color(0x14103E2F),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(26),
        side: const BorderSide(color: Color(0xE0D7E6DB)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: boksSurfaceSoft,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: boksBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: boksBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: boksBrand, width: 1.6),
      ),
      labelStyle: const TextStyle(color: boksMuted),
      floatingLabelStyle: const TextStyle(color: boksBrand),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: boksForest,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        elevation: 0,
        shadowColor: const Color(0x33103E2F),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: boksForest,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: boksBrand,
        minimumSize: const Size.fromHeight(48),
        side: const BorderSide(color: Color(0x662E8B57)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: boksBrand,
        minimumSize: const Size(44, 44),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: boksBrandLight,
      elevation: 8,
      height: 72,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          color: states.contains(WidgetState.selected) ? boksForest : boksMuted,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected) ? boksForest : boksMuted,
          size: 22,
        ),
      ),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: boksBrandBright,
      foregroundColor: boksForestDark,
      elevation: 3,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: boksForestDark,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    dividerTheme: const DividerThemeData(color: boksBorder, thickness: 1),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: boksBrand,
      linearTrackColor: boksBrandLight,
    ),
  );
}