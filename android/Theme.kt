package com.darkmisfitstudios.omniai.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.graphics.Color

/**
 * Dark Misfit Studios — OmniAI Nexus
 * Jetpack Compose Absolute Black Cyberpunk Theme Tokens
 */

// 1. APPLICATION CANVAS SURFACES (THE CORE BASE)
val PureShinyBlack = Color(0xFF000000)
val ObsidianPurple = Color(0xFF0A071B)
val ObsidianPurpleElevated = Color(0xFF110B29)
val ObsidianBorder = Color(0xFF1F1638)

// 2. PRIMARY BUTTON & NAVIGATION ACCENTS (PURPLISH-BLUE #0C00CA)
val PurplishBlue = Color(0xFF0C00CA)
val ElectricIndigo = Color(0xFF1D08E0)
val PurplishBlueBright = Color(0xFF3D2CF5)

// 3. DIAGNOSTIC METRICS & STATUS TEXT HIGHLIGHTS (BABY BLUE #00FFFF)
val BabyBlue = Color(0xFF00FFFF)
val TextLight = Color(0xFFF1F0F7)
val TextMuted = Color(0xFF8D87A8)

val AbsoluteBlackCyberpunkColorScheme = darkColorScheme(
    primary = PurplishBlue,
    onPrimary = Color.White,
    primaryContainer = ElectricIndigo,
    onPrimaryContainer = Color.White,
    secondary = BabyBlue,
    onSecondary = PureShinyBlack,
    secondaryContainer = Color(0xFF002F3A),
    onSecondaryContainer = BabyBlue,
    background = PureShinyBlack,
    onBackground = TextLight,
    surface = ObsidianPurple,
    onSurface = TextLight,
    surfaceVariant = ObsidianPurpleElevated,
    onSurfaceVariant = TextMuted,
    outline = ObsidianBorder
)

val ObsidianCyberpunkColorScheme = AbsoluteBlackCyberpunkColorScheme
