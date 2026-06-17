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
            "Engine",
            // Public: the presence component's attribute delegate handlers
            // reference FPanaudiaAttributeValue (USTRUCT from the Panaudia
            // module) in its public header.
            "Panaudia"
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            "Json",
            "JsonUtilities"
        });
    }
}
