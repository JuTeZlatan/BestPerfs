# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# @capacitor-firebase/authentication bundles optional provider handlers
# (Facebook, GitHub, etc.) that this app doesn't use/depend on - R8 only
# needs to know it's fine that those classes aren't present.
-dontwarn com.facebook.**

# R8 strips annotations by default unless told otherwise. Capacitor reads
# @CapacitorPlugin/@Permission via reflection at runtime to resolve plugin
# permission states (e.g. FirebaseMessaging.checkPermissions) - without this,
# that lookup silently gets null annotation data and crashes with a
# NullPointerException in com.getcapacitor's getPermissionStates, but only
# in the minified release build (never in debug), which is why it went
# unnoticed until testing an actual Play-signed release.
-keepattributes *Annotation*
