// OutlinePostEffect.shader — Roberts Cross edge detection on depth+normals
// Attach CameraOutline.cs to the camera; works on ALL rendered objects.
Shader "Hidden/OutlinePostEffect"
{
    Properties
    {
        _MainTex          ("Texture",          2D)           = "white" {}
        _OutlineColor     ("Outline Color",    Color)        = (0.05,0.05,0.08,1)
        _Thickness        ("Thickness",        Range(0.5,4)) = 1.2
        _DepthThreshold   ("Depth Threshold",  Range(0,0.5)) = 0.008
        _NormalThreshold  ("Normal Threshold", Range(0,1))   = 0.12
        _ColorThreshold   ("Color Threshold",  Range(0,1))   = 0.18
        _ColorWeight      ("Color Edge Weight",Range(0,1))   = 0.5
    }

    SubShader
    {
        Cull Off ZWrite Off ZTest Always

        Pass
        {
            CGPROGRAM
            #pragma vertex   vert_img
            #pragma fragment frag
            #pragma target   2.0
            #include "UnityCG.cginc"

            sampler2D _MainTex;
            float4    _MainTex_TexelSize;

            // Unity built-ins filled when depthTextureMode = DepthNormals
            sampler2D _CameraDepthNormalsTexture;

            half4 _OutlineColor;
            half  _Thickness;
            half  _DepthThreshold;
            half  _NormalThreshold;
            half  _ColorThreshold;
            half  _ColorWeight;

            // ── Roberts Cross: only 4 samples, fast on mobile ───────────
            half EdgeDetect(float2 uv)
            {
                float2 t = _MainTex_TexelSize.xy * _Thickness;

                // depth + normals samples (diagonal 2×2)
                float4 dn00 = tex2D(_CameraDepthNormalsTexture, uv);
                float4 dn11 = tex2D(_CameraDepthNormalsTexture, uv + t);
                float4 dn10 = tex2D(_CameraDepthNormalsTexture, uv + float2(t.x, 0));
                float4 dn01 = tex2D(_CameraDepthNormalsTexture, uv + float2(0,   t.y));

                float  d00; half3 n00; DecodeDepthNormal(dn00, d00, n00);
                float  d11; half3 n11; DecodeDepthNormal(dn11, d11, n11);
                float  d10; half3 n10; DecodeDepthNormal(dn10, d10, n10);
                float  d01; half3 n01; DecodeDepthNormal(dn01, d01, n01);

                half dEdge = abs(d00 - d11) + abs(d10 - d01);
                half nEdge = length(n00 - n11) + length(n10 - n01);

                half edge = step(_DepthThreshold,  dEdge)
                          + step(_NormalThreshold, nEdge);

                // ── Color edge: catches transparent/no-depth objects ─────
                half4 c00 = tex2D(_MainTex, uv);
                half4 c11 = tex2D(_MainTex, uv + t);
                half4 c10 = tex2D(_MainTex, uv + float2(t.x, 0));
                half4 c01 = tex2D(_MainTex, uv + float2(0,   t.y));

                half lum00 = dot(c00.rgb, half3(0.299h, 0.587h, 0.114h));
                half lum11 = dot(c11.rgb, half3(0.299h, 0.587h, 0.114h));
                half lum10 = dot(c10.rgb, half3(0.299h, 0.587h, 0.114h));
                half lum01 = dot(c01.rgb, half3(0.299h, 0.587h, 0.114h));

                half cEdge = abs(lum00 - lum11) + abs(lum10 - lum01);
                edge += step(_ColorThreshold, cEdge) * _ColorWeight;

                return saturate(edge);
            }

            half4 frag(v2f_img i) : SV_Target
            {
                half4 col  = tex2D(_MainTex, i.uv);
                half  edge = EdgeDetect(i.uv);
                // blend outline color over scene
                return lerp(col, _OutlineColor, edge * _OutlineColor.a);
            }
            ENDCG
        }
    }
}
