
#include "PanaudiaModule.h"

#include "CoreMinimal.h"
#include "Core.h"
#include "Modules/ModuleManager.h"
#include "Interfaces/IPluginManager.h"
#include "Misc/Paths.h"

#define LOCTEXT_NAMESPACE "FPanaudiaModule"

void FPanaudiaModule::StartupModule()
{
    UE_LOG(LogTemp, Log, TEXT("Panaudia Module Starting (MOQ/QUIC) v0.2.0-draft11-authfix"));

    UE_LOG(LogTemp, Log, TEXT("Panaudia Module Started"));
}

void FPanaudiaModule::ShutdownModule()
{
    UE_LOG(LogTemp, Log, TEXT("Panaudia Module Shutdown"));
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FPanaudiaModule, Panaudia)
