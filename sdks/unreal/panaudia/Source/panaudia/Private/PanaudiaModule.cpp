
#include "PanaudiaModule.h"

#include "CoreMinimal.h"
#include "Core.h"
#include "Modules/ModuleManager.h"
#include "Interfaces/IPluginManager.h"
#include "Misc/Paths.h"

#define LOCTEXT_NAMESPACE "FPanaudiaModule"

void FPanaudiaModule::StartupModule()
{
    UE_LOG(LogTemp, Log, TEXT("Panaudia Module Starting"));

    // Get the plugin base directory
    FString BaseDir = IPluginManager::Get().FindPlugin("panaudia")->GetBaseDir();

    // Load libdatachannel library (if it's a dynamic library)
    // Note: We're statically linking, so this isn't strictly necessary
    // But if you build as a shared library, you'd load it here

#if PLATFORM_WINDOWS
    FString LibraryPath = FPaths::Combine(BaseDir, TEXT("Source/ThirdParty/libdatachannel/build/Win64/Release/datachannel.dll"));
#elif PLATFORM_MAC
    FString LibraryPath = FPaths::Combine(BaseDir, TEXT("Source/ThirdParty/libdatachannel/build/Mac/Release/libdatachannel.dylib"));
#elif PLATFORM_LINUX
    FString LibraryPath = FPaths::Combine(BaseDir, TEXT("Source/ThirdParty/libdatachannel/build/Linux/Release/libdatachannel.so"));
#endif

    // Since we're statically linking, we don't need to load anything
    LibDataChannelHandle = nullptr;

    UE_LOG(LogTemp, Log, TEXT("Panaudia Module Started"));
}

void FPanaudiaModule::ShutdownModule()
{
    UE_LOG(LogTemp, Log, TEXT("Panaudia Module Shutdown"));

    // Unload library if dynamically loaded
    if (LibDataChannelHandle)
    {
        FPlatformProcess::FreeDllHandle(LibDataChannelHandle);
        LibDataChannelHandle = nullptr;
    }
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FPanaudiaModule, Panaudia)