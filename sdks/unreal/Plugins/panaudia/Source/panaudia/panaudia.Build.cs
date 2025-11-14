
using UnrealBuildTool;
using System.IO;

public class Panaudia : ModuleRules
{
    public Panaudia(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        CppStandard = CppStandardVersion.Cpp20;
        bEnableExceptions = true;
        // REMOVED: bUseRTTI = true;  // Don't enable RTTI - UE doesn't use it

        bUseUnity = false;  // Disable unity builds for better compilation

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "Projects"
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            "AudioMixer",
            "SignalProcessing",
            "AudioCapture",
            "AudioCaptureCore",
            "WebSockets",
            "Json",
            "JsonUtilities",
            "HTTP",
            "Sockets",
            "Networking"
        });

        if (Target.bBuildEditor == true)
        {
            PrivateDependencyModuleNames.Add("UnrealEd");
        }

        // Platform-specific AudioCapture implementations
        if (Target.Platform == UnrealTargetPlatform.Mac)
        {
//             PrivateDependencyModuleNames.Add("AudioCaptureAudioUnit");

            // Add required frameworks for AudioCapture on Mac
            PublicFrameworks.AddRange(new string[]
            {
                "CoreAudio",
                "AudioToolbox",
                "AudioUnit",
                "Security",
                "SystemConfiguration"
            });
        }
        else if (Target.Platform == UnrealTargetPlatform.Win64)
        {
            //PrivateDependencyModuleNames.Add("AudioCaptureWasapi");
        }

        string ThirdPartyPath = Path.Combine(ModuleDirectory, "../ThirdParty");

        if (Target.Platform == UnrealTargetPlatform.Mac)
        {
            // libdatachannel
            string LibDataChannelPath = Path.Combine(ThirdPartyPath, "libdatachannel");
            PublicIncludePaths.Add(Path.Combine(LibDataChannelPath, "include"));

            PublicAdditionalLibraries.Add(Path.Combine(LibDataChannelPath, "build/Mac/Release/libdatachannel.a"));
            PublicAdditionalLibraries.Add(Path.Combine(LibDataChannelPath, "build/Mac/Release/libusrsctp.a"));
            PublicAdditionalLibraries.Add(Path.Combine(LibDataChannelPath, "build/Mac/Release/libjuice.a"));
            PublicAdditionalLibraries.Add(Path.Combine(LibDataChannelPath, "build/Mac/Release/libsrtp2.a"));

            // libopus
            string LibOpusPath = Path.Combine(ThirdPartyPath, "opus");
            PublicIncludePaths.Add(Path.Combine(LibOpusPath, "include"));
            PublicAdditionalLibraries.Add(Path.Combine(LibOpusPath, "build/Mac/Release/libopus.a"));

            // OpenSSL (our custom build)
            string OpenSSLPath = Path.Combine(ThirdPartyPath, "openssl-1.1.1w/build/universal");
            PublicIncludePaths.Add(Path.Combine(OpenSSLPath, "include"));
            PublicAdditionalLibraries.Add(Path.Combine(OpenSSLPath, "lib/libssl.a"));
            PublicAdditionalLibraries.Add(Path.Combine(OpenSSLPath, "lib/libcrypto.a"));
        }
        else if (Target.Platform == UnrealTargetPlatform.Win64)
        {
            // Windows configuration
            string LibDataChannelPath = Path.Combine(ThirdPartyPath, "libdatachannel");
            PublicIncludePaths.Add(Path.Combine(LibDataChannelPath, "include"));
            PublicAdditionalLibraries.Add(Path.Combine(LibDataChannelPath, "build/Win64/Release/datachannel.lib"));

            string LibOpusPath = Path.Combine(ThirdPartyPath, "opus");
            PublicIncludePaths.Add(Path.Combine(LibOpusPath, "include"));
            PublicAdditionalLibraries.Add(Path.Combine(LibOpusPath, "build/Win64/Release/Release/opus.lib"));

            PublicSystemLibraries.AddRange(new string[]
            {
                "ws2_32.lib",
                "iphlpapi.lib",
                "bcrypt.lib"
            });
        }

        PublicDefinitions.Add("RTC_ENABLE_WEBSOCKET=0");
    }
}