// Legendary effect: glowing city lights clustered on land, only on the night side.
Shader "PixelPlanets/CityLights"
{
    Properties
    {
        _Rotation    ("Rotation",     Float)     = 0
        _LightOrigin ("Light Origin", Vector)    = (0.39,0.39,0,0)
        _TimeSpeed   ("Time Speed",   Float)     = 0.2
        _Size        ("Size",         Float)     = 50
        _Seed        ("Seed",         Float)     = 1
        _PlanetTime  ("Time",         Float)     = 0
        _Octaves     ("Octaves",      Int)       = 4
        _LightBorder1("Light Border1",Range(0,1))= 0.5
        _CityColor   ("City Color",   Color)     = (1.0, 0.78, 0.42, 1)
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" }
        Blend One One                 // additive glow
        ZWrite Off Cull Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            float  _Rotation, _TimeSpeed, _Size, _Seed, _PlanetTime, _LightBorder1;
            float4 _LightOrigin, _CityColor;
            int    _Octaves;

            struct a2v { float4 vertex:POSITION; float2 uv:TEXCOORD0; };
            struct v2f { float4 pos:SV_POSITION; float2 uv:TEXCOORD0; };

            v2f vert(a2v v) {
                v2f o; o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = float2(v.uv.x, 1-v.uv.y); return o;
            }

            float2 glmod(float2 x, float2 y) { return x - y*floor(x/y); }
            float rand(float2 c) {
                c = glmod(c, float2(2,1)*round(_Size));
                return frac(sin(dot(c, float2(12.9898,78.233)))*15.5453*_Seed);
            }
            float noise(float2 c) {
                float2 i=floor(c), f=frac(c);
                float a=rand(i),b=rand(i+float2(1,0)),cc=rand(i+float2(0,1)),d=rand(i+float2(1,1));
                float2 u=f*f*(3-2*f);
                return lerp(a,b,u.x)+(cc-a)*u.y*(1-u.x)+(d-b)*u.x*u.y;
            }
            float fbm(float2 c) {
                float v=0,s=0.5;
                for(int i=0;i<_Octaves;i++){v+=noise(c)*s;c*=2;s*=0.5;}
                return v;
            }
            float hash(float2 p){ return frac(sin(dot(p,float2(41.3,289.1)))*43758.5453*_Seed); }
            float2 spherify(float2 uv){ float2 c=uv*2-1; float z=sqrt(max(0,1-dot(c,c))); return (c/(z+1))*0.5+0.5; }
            float2 rot(float2 c,float a){ c-=0.5; float s=sin(a),co=cos(a); return mul(c,float2x2(co,s,-s,co))+0.5; }

            fixed4 frag(v2f i) : SV_Target {
                float2 uv = i.uv;
                float d_circle = distance(uv, float2(0.5,0.5));
                float a = 1.0 - smoothstep(0.487, 0.5, d_circle);
                float d_light = distance(uv, _LightOrigin.xy);

                uv = rot(uv, _Rotation);
                uv = spherify(uv);

                float2 base = uv*_Size + float2(_PlanetTime*_TimeSpeed, 0);
                float land  = smoothstep(0.45, 0.55, fbm(base));      // approx land mask
                float night = smoothstep(_LightBorder1, _LightBorder1+0.12, d_light);

                // City pixels: sparse high-frequency dots inside land
                float2 cell = floor(uv*_Size*2.2);
                float  dot  = step(0.86, hash(cell));
                float  flick= 0.7 + 0.3*sin(_PlanetTime*3.0 + hash(cell)*40.0);

                float intensity = land * night * dot * flick * a;
                return float4(_CityColor.rgb * intensity, 1);
            }
            ENDCG
        }
    }
}
