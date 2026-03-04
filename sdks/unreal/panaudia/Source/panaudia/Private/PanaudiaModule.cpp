
#include "PanaudiaModule.h"

#include "CoreMinimal.h"
#include "Core.h"
#include "Modules/ModuleManager.h"
#include "Interfaces/IPluginManager.h"
#include "Misc/Paths.h"

DEFINE_LOG_CATEGORY(LogPanaudia);

#define LOCTEXT_NAMESPACE "FPanaudiaModule"

void FPanaudiaModule::StartupModule()
{
    UE_LOG(LogPanaudia, Log, TEXT("Panaudia Module Starting (MOQ/QUIC) v0.3.0-core"));

    UE_LOG(LogPanaudia, Log, TEXT("Panaudia Module Started"));
}

void FPanaudiaModule::ShutdownModule()
{
    UE_LOG(LogPanaudia, Log, TEXT("Panaudia Module Shutdown"));
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FPanaudiaModule, Panaudia)
