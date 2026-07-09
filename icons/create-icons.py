#!/usr/bin/env python3
"""
创建 IMA Web Clipper 插件图标
生成简单的 PNG 图标文件
"""

import sys
import os
from PIL import Image, ImageDraw, ImageFont

def create_icon(size, color="#1a73e8", text="IMA"):
    """创建指定尺寸的图标"""
    # 创建新图像
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 计算圆角半径
    radius = size // 8
    
    # 绘制圆角矩形
    draw.rounded_rectangle([(0, 0), (size-1, size-1)], radius=radius, fill=color)
    
    # 添加文字
    try:
        # 尝试使用系统字体
        font = ImageFont.truetype("Arial", size=size//3)
    except:
        # 回退到默认字体
        font = ImageFont.load_default()
    
    # 计算文字位置
    text_bbox = draw.textbbox((0, 0), text, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    
    x = (size - text_width) // 2
    y = (size - text_height) // 2
    
    # 绘制文字
    draw.text((x, y), text, fill="white", font=font)
    
    return img

def main():
    """主函数"""
    print("🎨 创建 IMA Web Clipper 图标...")
    
    # 需要创建的图标尺寸
    icon_sizes = [
        (16, "icon16.png"),
        (48, "icon48.png"),
        (128, "icon128.png")
    ]
    
    created_count = 0
    
    for size, filename in icon_sizes:
        try:
            # 创建图标
            icon = create_icon(size)
            
            # 保存为 PNG
            filepath = os.path.join(os.path.dirname(__file__), filename)
            icon.save(filepath, "PNG")
            
            print(f"✅ 创建: {filename} ({size}x{size})")
            created_count += 1
            
        except Exception as e:
            print(f"❌ 创建 {filename} 失败: {e}")
    
    print(f"\n📊 完成: 成功创建 {created_count}/{len(icon_sizes)} 个图标")
    
    if created_count == len(icon_sizes):
        print("🎉 所有图标已成功创建！")
    else:
        print("⚠️  部分图标创建失败，可能需要手动创建")
        print("\n手动创建建议：")
        print("1. 使用在线工具将 SVG 转换为 PNG")
        print("2. 使用图像编辑软件创建简单图标")
        print("3. 确保文件名为: icon16.png, icon48.png, icon128.png")

if __name__ == "__main__":
    # 检查 PIL 是否安装
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("❌ 需要安装 Pillow 库")
        print("安装命令: pip install Pillow")
        sys.exit(1)
    
    main()