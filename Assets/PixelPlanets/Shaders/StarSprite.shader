// Additive textured star sprite (white-on-black PNGs). _Color carries tint + brightness.
Shader "PixelPlanets/StarSprite"
{
    Properties
    {
        _MainTex ("Texture", 2D)    = "white" {}
        _Color   ("Color",   Color) = (1,1,1,1)
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" }
        Blend One One                 // additive
        ZWrite Off Cull Off ZTest Always
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            sampler2D _MainTex;
            float4    _MainTex_ST, _Color;

            struct a2v { float4 vertex:POSITION; float2 uv:TEXCOORD0; };
            struct v2f { float4 pos:SV_POSITION; float2 uv:TEXCOORD0; };

            v2f vert(a2v v) {
                v2f o; o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex); return o;
            }
            fixed4 frag(v2f i) : SV_Target {
                fixed4 t = tex2D(_MainTex, i.uv);
                float  lum = max(t.r, max(t.g, t.b));   // white sprite → luminance
                return float4(_Color.rgb * lum, 1);
            }
            ENDCG
        }
    }
}
