// Toon version — smooth crater layer
Shader "PixelPlanets/PlanetCraters"
{
    Properties
    {
        _Rotation    ("Rotation",     Float)     = 0
        _LightOrigin ("Light Origin", Vector)    = (0.39,0.39,0,0)
        _TimeSpeed   ("Time Speed",   Float)     = 0.2
        _LightBorder ("Light Border", Range(0,1))= 0.4
        _Size         ("Size",          Float)     = 50
        _Seed         ("Seed",          Float)     = 1
        _PlanetTime   ("Time",          Float)     = 0
        _CraterCutoff ("Crater Cutoff", Range(0,1))= 0.50
        _CraterRadius ("Crater Radius", Range(0.2,3))= 1.0
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" }
        Blend SrcAlpha OneMinusSrcAlpha
        ZWrite Off Cull Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            float  _Rotation, _TimeSpeed, _LightBorder;
            float4 _LightOrigin;
            float  _Size, _Seed, _PlanetTime, _CraterCutoff, _CraterRadius;
            float4 _Colors[2];

            struct a2v { float4 vertex:POSITION; float2 uv:TEXCOORD0; };
            struct v2f { float4 pos:SV_POSITION; float2 uv:TEXCOORD0; };

            v2f vert(a2v v) {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv  = float2(v.uv.x, 1-v.uv.y);
                return o;
            }

            float2 glmod(float2 x, float2 y) { return x - y*floor(x/y); }
            float rand(float2 coord) {
                coord = glmod(coord, float2(1,1)*round(_Size));
                return frac(sin(dot(coord, float2(12.9898,78.233)))*15.5453*_Seed);
            }
            // Samples a 3x3 neighbourhood so a crater can bleed across cell borders.
            // This keeps circles COMPLETE even when _CraterRadius is large (no half/quarter holes).
            float circleNoise(float2 uv) {
                float result = 1.0;
                float2 ip = floor(uv);
                for (int yy = -1; yy <= 1; yy++) {
                    for (int xx = -1; xx <= 1; xx++) {
                        float2 cell = ip + float2(xx, yy);
                        float h  = rand(cell);
                        float h2 = rand(cell + 17.0);
                        float2 center = cell + float2(0.25 + h*0.5, 0.25 + h2*0.5);
                        float m = length(uv - center);
                        float r = h * 0.25 * _CraterRadius;   // _CraterRadius scales hole size only
                        result = min(result, smoothstep(r - 0.1*r, r, m));
                    }
                }
                return result;
            }
            float crater(float2 uv) {
                float c = 1;
                float2 scroll = float2(_PlanetTime*_TimeSpeed, 0);
                for(int i=0;i<2;i++) c *= circleNoise(uv*_Size + (float(i+1)+10.0) + scroll);
                return 1-c;
            }
            float2 spherify(float2 uv) {
                float2 c=uv*2-1;
                float z=sqrt(max(0,1-dot(c,c)));
                return (c/(z+1))*0.5+0.5;
            }
            float2 rot(float2 coord, float angle) {
                coord-=0.5; float c=cos(angle),s=sin(angle);
                return mul(coord, float2x2(c,s,-s,c))+0.5;
            }

            fixed4 frag(v2f i) : SV_Target {
                float2 uv      = i.uv;
                float d_circle = distance(uv, float2(0.5,0.5));
                float a        = 1.0 - smoothstep(0.487, 0.5, d_circle);
                float d_light  = distance(uv, _LightOrigin.xy);

                uv = rot(uv, _Rotation);
                uv = spherify(uv);

                float c1 = crater(uv);
                float c2 = crater(uv + (_LightOrigin.xy-0.5)*0.03);

                // Smooth crater edge
                // _CraterCutoff: higher = more craters visible
                float craterAlpha = smoothstep((1.0-_CraterCutoff)-0.05, (1.0-_CraterCutoff)+0.05, c1);
                float shadow = smoothstep(0, 0.05, c1-c2-(0.5-d_light)*2.0);
                float lightShadow = smoothstep(_LightBorder-0.03, _LightBorder+0.03, d_light);

                float4 col = lerp(_Colors[0], _Colors[1], max(shadow, lightShadow));
                return float4(col.rgb, craterAlpha*a*col.a);
            }
            ENDCG
        }
    }
}
