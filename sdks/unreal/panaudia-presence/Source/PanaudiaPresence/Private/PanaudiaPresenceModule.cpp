#include "PanaudiaPresenceModule.h"

DEFINE_LOG_CATEGORY(LogPanaudiaPresence);

#define LOCTEXT_NAMESPACE "FPanaudiaPresenceModule"

void FPanaudiaPresenceModule::StartupModule()
{
    UE_LOG(LogPanaudiaPresence, Log, TEXT("PanaudiaPresence Module Started"));
}

void FPanaudiaPresenceModule::ShutdownModule()
{
    UE_LOG(LogPanaudiaPresence, Log, TEXT("PanaudiaPresence Module Shutdown"));
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FPanaudiaPresenceModule, PanaudiaPresence)
