// Legendary effect: wavy polar aurora glow near the top & bottom of the disc.
Shader "PixelPlanets/Aurora"
{
    Properties
    {
        _Rotation    ("Rotation",     Float)  = 0
        _LightOrigin ("Light Origin", Vector) = (0.39,0.39,0,0)
        _TimeSpeed   ("Time Speed",   Float)  = 0.2
        _Size        ("Size",         Float)  = 50
        _Seed        ("Seed",         Float)  = 1
        _PlanetTime  ("Time",         Float)  = 0
        _AuroraA     ("Aurora A",     Color)  = (0.20, 1.00, 0.55, 1)
        _AuroraB     ("Aurora B",     Color)  = (0.55, 0.30, 1.00, 1)
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" }
        Blend One One                 // additive
        ZWrite Off Cull Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            float  _Rotation, _TimeSpeed, _Size, _Seed, _PlanetTime;
            float4 _LightOrigin, _AuroraA, _AuroraB;

            struct a2v { float4 vertex:POSITION; float2 uv:TEXCOORD0; };
            struct v2f { float4 pos:SV_POSITION; float2 uv:TEXCOORD0; };

            v2f vert(a2v v) {
                v2f o; o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = float2(v.uv.x, 1-v.uv.y); return o;
            }

            float hash(float2 p){ return frac(sin(dot(p,float2(27.61,98.3)))*43758.5453*_Seed); }
            float vnoise(float2 p){
                float2 i=floor(p),f=frac(p); float2 u=f*f*(3-2*f);
                float a=hash(i),b=hash(i+float2(1,0)),c=hash(i+float2(0,1)),d=hash(i+float2(1,1));
                return lerp(lerp(a,b,u.x),lerp(c,d,u.x),u.y);
            }
            float2 spherify(float2 uv){ float2 c=uv*2-1; float z=sqrt(max(0,1-dot(c,c))); return (c/(z+1))*0.5+0.5; }

            // Glow band centered at polar latitude `lat`, wavering over time.
            float band(float2 uv, float lat) {
                float wave = (vnoise(float2(uv.x*6.0 + _PlanetTime*_TimeSpeed, lat*3.0)) - 0.5) * 0.16;
                float curtain = vnoise(float2(uv.x*14.0 - _PlanetTime*_TimeSpeed*1.5, lat*5.0));
                float d = abs(uv.y - (lat + wave));
                float g = smoothstep(0.13, 0.0, d);
                return g * (0.5 + 0.5*curtain);
            }

            fixed4 frag(v2f i) : SV_Target {
                float2 uv = i.uv;
                float d_circle = distance(uv, float2(0.5,0.5));
                float a = 1.0 - smoothstep(0.487, 0.5, d_circle);
                float2 suv = spherify(uv);

                float top = band(suv, 0.18);   // north pole
                float bot = band(suv, 0.82);   // south pole
                float g   = top + bot;

                // colour shifts along x for that shimmering aurora feel
                float mixv = 0.5 + 0.5*sin(suv.x*5.0 + _PlanetTime*_TimeSpeed*2.0);
                float3 col = lerp(_AuroraA.rgb, _AuroraB.rgb, mixv);

                return float4(col * g * a * 0.9, 1);
            }
            ENDCG
        }
    }
}
