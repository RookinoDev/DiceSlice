// ToonLit.shader — Mobile-optimized 2-pass cel shader
// Pass 1 : Backface outline (screen-space consistent width)
// Pass 2 : Toon surface  (stepped diffuse + hard specular + rim)
Shader "Toon/ToonLit"
{
    Properties
    {
        [Header(Surface)]
        _MainTex      ("Albedo (RGB)",      2D)            = "white" {}
        _Color        ("Color",             Color)         = (1,1,1,1)

        [Header(Shading)]
        _ShadowColor  ("Shadow Color",      Color)         = (0.22,0.22,0.32,1)
        _Steps        ("Shade Steps",       Range(2,4))    = 3
        _ShadowEdge   ("Shadow Edge Soft",  Range(0,0.15)) = 0.04

        [Header(Rim)]
        _RimColor     ("Rim Color",         Color)         = (0.55,0.75,1,1)
        _RimPower     ("Rim Power",         Range(1,8))    = 4
        _RimStrength  ("Rim Strength",      Range(0,1))    = 0.55

        [Header(Specular)]
        _SpecColor2   ("Specular Color",    Color)         = (1,1,1,1)
        _SpecGloss    ("Gloss",             Range(10,512)) = 120
        _SpecStrength ("Specular Strength", Range(0,1))    = 0.6

        [Header(Outline)]
        _OutlineWidth ("Outline Width",     Range(0,0.06)) = 0.018
        _OutlineColor ("Outline Color",     Color)         = (0.06,0.06,0.10,1)
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        LOD 150

        // ── Pass 1 : Outline ──────────────────────────────────────────
        Pass
        {
            Name "OUTLINE"
            Cull Front          // draw only back-faces, hull expands outward
            ZWrite On

            CGPROGRAM
            #pragma vertex   vertOutline
            #pragma fragment fragOutline
            #pragma multi_compile_fog
            #pragma target 2.0
            #include "UnityCG.cginc"

            half  _OutlineWidth;
            half4 _OutlineColor;

            struct a2v_o { float4 vertex : POSITION; float3 normal : NORMAL; };
            struct v2f_o { float4 pos : SV_POSITION; UNITY_FOG_COORDS(0) };

            v2f_o vertOutline(a2v_o v)
            {
                v2f_o o;
                // Clip-space extrusion → width stays constant in screen pixels
                float4 clip = UnityObjectToClipPos(v.vertex);
                float3 clipN = normalize(mul((float3x3)UNITY_MATRIX_VP,
                               mul((float3x3)unity_ObjectToWorld, v.normal)));
                clip.xy += clipN.xy * (_OutlineWidth * clip.w);
                o.pos = clip;
                UNITY_TRANSFER_FOG(o, o.pos);
                return o;
            }

            half4 fragOutline(v2f_o i) : SV_Target
            {
                half4 c = _OutlineColor;
                UNITY_APPLY_FOG(i.fogCoord, c);
                return c;
            }
            ENDCG
        }

        // ── Pass 2 : Toon Surface ─────────────────────────────────────
        Pass
        {
            Name "TOON_FORWARD"
            Tags { "LightMode" = "ForwardBase" }
            Cull Back

            CGPROGRAM
            #pragma vertex   vert
            #pragma fragment frag
            #pragma multi_compile_fwdbase
            #pragma multi_compile_fog
            #pragma target 2.0
            #include "UnityCG.cginc"
            #include "Lighting.cginc"
            #include "AutoLight.cginc"

            sampler2D _MainTex;
            float4    _MainTex_ST;

            half4 _Color;
            half4 _ShadowColor;
            half  _Steps;
            half  _ShadowEdge;

            half4 _RimColor;
            half  _RimPower;
            half  _RimStrength;

            half4 _SpecColor2;
            half  _SpecGloss;
            half  _SpecStrength;

            struct a2v
            {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
                float2 uv     : TEXCOORD0;
            };

            struct v2f
            {
                float4 pos        : SV_POSITION;
                float2 uv         : TEXCOORD0;
                half3  worldN     : TEXCOORD1;
                float3 worldPos   : TEXCOORD2;
                SHADOW_COORDS(3)
                UNITY_FOG_COORDS(4)
            };

            v2f vert(a2v v)
            {
                v2f o;
                o.pos      = UnityObjectToClipPos(v.vertex);
                o.uv       = TRANSFORM_TEX(v.uv, _MainTex);
                o.worldN   = UnityObjectToWorldNormal(v.normal);
                o.worldPos = mul(unity_ObjectToWorld, v.vertex).xyz;
                TRANSFER_SHADOW(o);
                UNITY_TRANSFER_FOG(o, o.pos);
                return o;
            }

            half4 frag(v2f i) : SV_Target
            {
                half3 N = normalize(i.worldN);
                half3 L = normalize(_WorldSpaceLightPos0.xyz);
                half3 V = normalize(_WorldSpaceCameraPos.xyz - i.worldPos);
                half3 H = normalize(L + V);

                // ── Albedo ────────────────────────────────────────────
                half4 albedo = tex2D(_MainTex, i.uv) * _Color;

                // ── Shadow attenuation (receives Unity shadows) ───────
                half shadow = SHADOW_ATTENUATION(i);

                // ── Stepped diffuse ───────────────────────────────────
                half NdotL  = saturate(dot(N, L)) * shadow;
                // Smooth step between bands for a clean edge
                half cel    = floor(NdotL * _Steps + _ShadowEdge) / _Steps;
                cel         = saturate(cel);

                half3 ambient  = unity_AmbientSky.rgb * 0.35h;
                half3 diffuse  = lerp(_ShadowColor.rgb + ambient,
                                      _LightColor0.rgb, cel);

                // ── Hard specular ─────────────────────────────────────
                half NdotH  = saturate(dot(N, H));
                half spec   = step(1.0h - _SpecStrength * 0.5h,
                                   pow(NdotH, _SpecGloss)) * shadow;
                half3 specular = _SpecColor2.rgb * spec * _SpecStrength;

                // ── Rim light (fresnel, only on lit side) ─────────────
                half rim    = 1.0h - saturate(dot(V, N));
                rim         = pow(rim, _RimPower) * cel * _RimStrength;
                half3 rimL  = _RimColor.rgb * rim;

                // ── Composite ─────────────────────────────────────────
                half3 col = albedo.rgb * diffuse + specular + rimL;
                half4 c   = half4(col, albedo.a);
                UNITY_APPLY_FOG(i.fogCoord, c);
                return c;
            }
            ENDCG
        }

        // ── ForwardAdd : additional point/spot lights ─────────────────
        Pass
        {
            Name "TOON_ADD"
            Tags { "LightMode" = "ForwardAdd" }
            Blend One One
            ZWrite Off
            Cull Back

            CGPROGRAM
            #pragma vertex   vertAdd
            #pragma fragment fragAdd
            #pragma multi_compile_fwdadd_fullshadows
            #pragma multi_compile_fog
            #pragma target 2.0
            #include "UnityCG.cginc"
            #include "Lighting.cginc"
            #include "AutoLight.cginc"

            sampler2D _MainTex;
            float4    _MainTex_ST;
            half4     _Color;
            half      _Steps;
            half      _ShadowEdge;
            half4     _SpecColor2;
            half      _SpecGloss;
            half      _SpecStrength;

            struct a2v { float4 vertex:POSITION; float3 normal:NORMAL; float2 uv:TEXCOORD0; };
            struct v2f {
                float4 pos:SV_POSITION; float2 uv:TEXCOORD0;
                half3 worldN:TEXCOORD1; float3 worldPos:TEXCOORD2;
                SHADOW_COORDS(3) UNITY_FOG_COORDS(4)
            };

            v2f vertAdd(a2v v) {
                v2f o;
                o.pos      = UnityObjectToClipPos(v.vertex);
                o.uv       = TRANSFORM_TEX(v.uv, _MainTex);
                o.worldN   = UnityObjectToWorldNormal(v.normal);
                o.worldPos = mul(unity_ObjectToWorld, v.vertex).xyz;
                TRANSFER_SHADOW(o);
                UNITY_TRANSFER_FOG(o, o.pos);
                return o;
            }

            half4 fragAdd(v2f i) : SV_Target {
                half3 N    = normalize(i.worldN);
                half3 L    = normalize(_WorldSpaceLightPos0.xyz - i.worldPos);
                half3 V    = normalize(_WorldSpaceCameraPos.xyz - i.worldPos);
                half3 H    = normalize(L + V);
                half4 alb  = tex2D(_MainTex, i.uv) * _Color;
                half  atten= SHADOW_ATTENUATION(i);
                half  NdotL= saturate(dot(N, L)) * atten;
                half  cel  = floor(NdotL * _Steps + _ShadowEdge) / _Steps;
                half  spec = step(1.0h - _SpecStrength * 0.5h, pow(saturate(dot(N,H)),_SpecGloss)) * atten;
                half3 col  = alb.rgb * _LightColor0.rgb * cel
                           + _SpecColor2.rgb * spec * _SpecStrength;
                half4 c    = half4(col, 0);
                UNITY_APPLY_FOG(i.fogCoord, c);
                return c;
            }
            ENDCG
        }

        // ── ShadowCaster ──────────────────────────────────────────────
        UsePass "Legacy Shaders/VertexLit/SHADOWCASTER"
    }

    FallBack "Diffuse"
    CustomEditor "UnityEditor.MaterialEditor"
}
