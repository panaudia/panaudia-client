
using UnrealBuildTool;
using System.IO;

public class Panaudia : ModuleRules
{
    public Panaudia(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        CppStandard = CppStandardVersion.Cpp20;
        bEnableExceptions = true;

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
            "AudioExtensions",
            "SignalProcessing",
            "AudioCapture",
            "AudioCaptureCore",
            "Json",
            "JsonUtilities"
        });

        if (Target.bBuildEditor == true)
        {
            PrivateDependencyModuleNames.Add("UnrealEd");
        }

        string ThirdPartyPath = Path.Combine(ModuleDirectory, "../ThirdParty");

        if (Target.Platform == UnrealTargetPlatform.Mac)
        {
            // libpanaudia-core + dependencies (all static)
            string CorePath = Path.Combine(ThirdPartyPath, "panaudia-core");
            PublicIncludePaths.Add(Path.Combine(CorePath, "include"));
            PublicAdditionalLibraries.Add(Path.Combine(CorePath, "lib/Mac/libpanaudia-core.a"));
            PublicAdditionalLibraries.Add(Path.Combine(CorePath, "lib/Mac/libopus.a"));
            PublicAdditionalLibraries.Add(Path.Combine(CorePath, "lib/Mac/libmsquic.a"));

            // macOS frameworks
            PublicFrameworks.AddRange(new string[]
            {
                "CoreAudio",
                "AudioToolbox",
                "AudioUnit",
                "Security"
            });
        }
        else if (Target.Platform == UnrealTargetPlatform.Win64)
        {
            PublicSystemLibraries.AddRange(new string[]
            {
                "ws2_32.lib",
                "iphlpapi.lib",
                "bcrypt.lib",
                "secur32.lib",
                "ncrypt.lib",
                "crypt32.lib"
            });

            // msquic (QUIC transport)
            string MsQuicPath = Path.Combine(ThirdPartyPath, "msquic");
            PublicIncludePaths.Add(Path.Combine(MsQuicPath, "include"));
            PublicAdditionalLibraries.Add(Path.Combine(MsQuicPath, "build/Win64/Release/msquic.lib"));

            // libopus (audio codec — unchanged)
            string LibOpusPath = Path.Combine(ThirdPartyPath, "opus");
            PublicIncludePaths.Add(Path.Combine(LibOpusPath, "include"));
            PublicAdditionalLibraries.Add(Path.Combine(LibOpusPath, "build/Win64/Release/opus.lib"));
        }
    }
}
