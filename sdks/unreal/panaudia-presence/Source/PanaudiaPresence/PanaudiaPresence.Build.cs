using UnrealBuildTool;

public class PanaudiaPresence : ModuleRules
{
    public PanaudiaPresence(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine"
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            "Panaudia",
            "Json",
            "JsonUtilities"
        });
    }
}
