// Galaxy.shader — spiral galaxy with volumetric glow, toon color bands
Shader "PixelPlanets/Galaxy"
{
    Properties
    {
        _Rotation  ("Rotation",   Float)        = 0
        _PlanetTime("Time",       Float)        = 0
        _TimeSpeed ("Time Speed", Float)        = 0.018
        _Twist     ("Spiral Twist",Range(1,12)) = 5
        _Tilt      ("Disk Tilt",   Range(0.25,1))= 0.48
        _ArmWidth  ("Arm Width",   Range(1,10)) = 3.5
        _CoreSize  ("Core Size",   Range(10,80))= 40
        _Size      ("Noise Scale", Float)       = 4
        _Seed      ("Seed",        Float)       = 1
        _Octaves   ("Octaves",     Int)         = 4
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
            #pragma target 3.0
            #include "UnityCG.cginc"

            float  _Rotation, _PlanetTime, _TimeSpeed;
            float  _Twist, _Tilt, _ArmWidth, _CoreSize, _Size, _Seed;
            int    _Octaves;
            float4 _Colors[4];  // [0]=core  [1]=bright arm  [2]=outer halo  [3]=dim particles

            struct a2v { float4 vertex:POSITION; float2 uv:TEXCOORD0; };
            struct v2f { float4 pos:SV_POSITION; float2 uv:TEXCOORD0; };

            v2f vert(a2v v) {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv  = float2(v.uv.x, 1-v.uv.y);
                return o;
            }

            // ── Noise ────────────────────────────────────────────────
            float rand(float2 co) {
                return frac(sin(dot(co, float2(127.1,311.7)))*43758.5453*_Seed);
            }
            float noise(float2 coord) {
                float2 i=floor(coord), f=frac(coord);
                float a=rand(i),b=rand(i+float2(1,0)),c=rand(i+float2(0,1)),d=rand(i+float2(1,1));
                float2 u=f*f*(3-2*f);
                return lerp(a,b,u.x)+(c-a)*u.y*(1-u.x)+(d-b)*u.x*u.y;
            }
            float fbm(float2 p) {
                float v=0,s=0.5;
                for(int i=0;i<_Octaves;i++){v+=noise(p)*s;p*=2.1;s*=0.5;}
                return v;
            }

            // ── Galaxy SDF ───────────────────────────────────────────
            float galaxy(float2 uv, out float coreStrength)
            {
                // Disk perspective tilt
                uv.y /= _Tilt;
                float r     = length(uv);
                float angle = atan2(uv.y, uv.x);

                // Slow rotation animation
                float anim = angle - _PlanetTime * _TimeSpeed - _Rotation;

                // 2 opposite spiral arms
                float arms = 0;
                [unroll]
                for(int k=0; k<2; k++) {
                    float baseA = UNITY_PI * k;
                    float da    = (anim - baseA - _Twist * r * UNITY_PI) / UNITY_TWO_PI;
                    da = frac(da);
                    if (da > 0.5) da = 1.0 - da;       // fold: 0=on arm centre
                    float arm = exp(-da * da * _ArmWidth * 2.0);
                    arm      *= exp(-r * 3.8);           // radial falloff from centre
                    arms     += arm;
                }

                // Irregular noise texture on arms (dust lanes, star clusters)
                float2 nuv = float2(r * _Size, anim * 0.5 + r * _Size * 0.25);
                float  n   = fbm(nuv) * 0.55 + 0.45;
                arms *= n;

                // Sparse star particles scattered in disk
                float stars = pow(max(0, noise(uv*_Size*2.8+float2(33,77))), 7.0);
                stars *= exp(-r*6.0);

                // Central core bulge — spherical, warm
                coreStrength = exp(-r*r*_CoreSize);

                return arms + stars * 0.5 + coreStrength * 3.5;
            }

            fixed4 frag(v2f i) : SV_Target {
                float2 uv = i.uv - 0.5;

                float core;
                float b = galaxy(uv, core);

                // Hard edge at galaxy boundary — but organic (not perfect circle)
                b *= smoothstep(0.56, 0.46, length(uv));

                // Toon color bands — 4 levels, smooth transitions
                float t3 = smoothstep(0.04, 0.12, b);  // dim halo/particles
                float t2 = smoothstep(0.22, 0.42, b);  // outer arms
                float t1 = smoothstep(0.60, 0.90, b);  // bright arm
                float t0 = smoothstep(1.10, 1.60, b);  // core

                float4 col = float4(0,0,0,0);
                col = lerp(col,       _Colors[3], t3);
                col = lerp(col,       _Colors[2], t2);
                col = lerp(col,       _Colors[1], t1);
                col = lerp(col,       _Colors[0], t0);

                // Alpha: organic glow, not a hard circle
                float alpha = smoothstep(0.025, 0.10, b) * col.a;
                return float4(col.rgb, alpha);
            }
            ENDCG
        }
    }
}
