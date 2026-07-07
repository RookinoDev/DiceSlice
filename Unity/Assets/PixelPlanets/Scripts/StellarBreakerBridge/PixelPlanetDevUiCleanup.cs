using UnityEngine;

/// <summary>
/// Strips PixelPlanetGenerator's built-in dev UI (manual tweaker + "New Planet" reroll button)
/// at runtime so it doesn't appear in the game scene.
///
/// FRAGILE by nature: it depends on the generator's runtime object names ("PlanetUI" /
/// "RerollButton") and the PlanetTweakerUI component. Isolated here so this is the ONLY place
/// that coupling exists — easy to find, change, or delete when the visual is reskinned.
/// </summary>
public static class PixelPlanetDevUiCleanup
{
    public static void Strip(PixelPlanetGenerator generator)
    {
        if (generator != null)
        {
            var tweaker = generator.GetComponent<PlanetTweakerUI>();
            if (tweaker != null) Object.Destroy(tweaker);
        }

        var ui = GameObject.Find("PlanetUI");
        if (ui != null)
        {
            var btn = ui.transform.Find("RerollButton");
            if (btn != null) Object.Destroy(btn.gameObject);
        }
    }
}
