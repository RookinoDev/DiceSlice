// Toon Star — smooth Voronoi surface, no pixelation
Shader "PixelPlanets/Star"
{
    Properties
    {
        _Rotation    ("Rotation",   Float) = 0
        _TimeSpeed   ("Time Speed", Float) = 0.05
        _PlanetTime  ("Time",       Float) = 0
        _Size        ("Size",       Float) = 50
        _Tiles       ("Tiles",      Float) = 1
        _Seed        ("Seed",       Float) = 1
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

            float  _Rotation, _TimeSpeed, _PlanetTime, _Size, _Tiles, _Seed;
            float4 _Colors[4];

            struct a2v { float4 vertex:POSITION; float2 uv:TEXCOORD0; };
            struct v2f { float4 pos:SV_POSITION; float2 uv:TEXCOORD0; };

            v2f vert(a2v v) {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv  = float2(v.uv.x, 1-v.uv.y);
                return o;
            }

            float2 glmod(float2 x, float2 y) { return x - y*floor(x/y); }

            float2 Hash2(float2 p) {
                float r = 523.0*sin(dot(p, float2(53.3158,43.6143)));
                return float2(frac(15.32354*r), frac(17.25865*r));
            }

            float Cells(float2 p, float numCells) {
                p *= numCells;
                float d = 1e10;
                for(int xo=-1;xo<=1;xo++)
                    for(int yo=-1;yo<=1;yo++) {
                        float2 tp = floor(p) + float2(xo,yo);
                        tp = p - tp - Hash2(glmod(tp, numCells/_Tiles));
                        d = min(d, dot(tp,tp));
                    }
                return sqrt(d);
            }

            float2 rot(float2 v, float a) {
                v -= 0.5; float c=cos(a),s=sin(a);
                return mul(v, float2x2(c,s,-s,c))+0.5;
            }
            float2 spherify(float2 uv) {
                float2 c=uv*2-1;
                float z=sqrt(max(0,1-dot(c,c)));
                return (c/(z+1))*0.5+0.5;
            }

            fixed4 frag(v2f i) : SV_Target {
                float2 uv  = i.uv;
                float  d   = distance(uv, float2(0.5,0.5));
                float  a   = 1.0 - smoothstep(0.487, 0.5, d);

                uv = rot(uv, _Rotation);
                uv = spherify(uv);

                float n  = Cells(uv - float2(_PlanetTime*_TimeSpeed*2,0), 10);
                      n *= Cells(uv - float2(_PlanetTime*_TimeSpeed,  0), 20);
                n = clamp(n*2, 0, 1);

                // Smooth toon posterization — 4 bands
                float t0 = smoothstep(0.32-0.03, 0.32+0.03, n);
                float t1 = smoothstep(0.62-0.03, 0.62+0.03, n);
                float t2 = smoothstep(0.88-0.03, 0.88+0.03, n);

                float4 col = _Colors[0];
                col = lerp(col, _Colors[1], t0);
                col = lerp(col, _Colors[2], t1);
                col = lerp(col, _Colors[3], t2);
                return float4(col.rgb, a*col.a);
            }
            ENDCG
        }
    }
}
